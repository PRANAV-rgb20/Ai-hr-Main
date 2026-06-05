"""HR Policy Chatbot (RAG) — /api/v1/ai/policy/"""
import asyncio
import io
import logging
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pdfminer.high_level import extract_text
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import cosine_similarity, get_embedding
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.openrouter import chat
from app.models.policy import PolicyDocument
from app.models.user import User

logger = logging.getLogger("hrms.ai.policy")

router = APIRouter(prefix="/ai", tags=["AI - Policy Chatbot"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _extract_text_from_bytes(pdf_bytes: bytes) -> str:
    try:
        return extract_text(io.BytesIO(pdf_bytes))
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def _chunk_text(text: str, chunk_words: int = 350, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_words])
        if chunk.strip():
            chunks.append(chunk.strip())
        i += chunk_words - overlap
    return chunks


# ── schemas ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/policy/upload/")
async def upload_policy(
    pdf_file: UploadFile = File(...),
    title: str = Form(...),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin")),
):
    """Upload a PDF policy document. Chunks it and stores embeddings in DB."""
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Try Cloudinary upload — optional, don't fail if unavailable
    file_url = ""
    try:
        from app.core.cloudinary_upload import upload_resume_pdf
        file_url = await upload_resume_pdf(pdf_file, "policy", title.lower().replace(" ", "_"))
    except Exception:
        pass

    text = await asyncio.to_thread(_extract_text_from_bytes, pdf_bytes)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    chunks = _chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks could be created")

    # Delete existing chunks for this title (re-upload replaces)
    existing = await db.execute(select(PolicyDocument).where(PolicyDocument.title == title))
    for doc in existing.scalars().all():
        await db.delete(doc)

    saved = 0
    for i, chunk in enumerate(chunks):
        emb = await get_embedding(chunk)
        emb_str = ",".join(f"{v:.6f}" for v in emb)
        db.add(PolicyDocument(
            title=title,
            file_url=file_url,
            chunk_index=i,
            chunk_text=chunk,
            embedding_str=emb_str,
        ))
        saved += 1

    await db.commit()
    logger.info(f"Policy '{title}' uploaded: {saved} chunks")
    return {"message": "Policy uploaded successfully", "title": title, "chunks_created": saved}


@router.post("/policy/chat/")
async def chat_with_policy(
    req: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(get_current_user),
):
    """Answer an employee question using RAG over uploaded policy documents."""
    if not req.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    # Embed the question
    q_emb = await get_embedding(req.question)

    # Fetch all document chunks
    result = await db.execute(
        select(
            PolicyDocument.title,
            PolicyDocument.chunk_text,
            PolicyDocument.embedding_str,
        )
    )
    all_docs = result.all()

    if not all_docs:
        return {
            "answer": "No policy documents have been uploaded yet. Please ask your HR admin to upload company policy documents.",
            "sources": [],
        }

    # Score chunks by cosine similarity
    scored = []
    for title, chunk_text, emb_str in all_docs:
        try:
            emb = np.fromstring(emb_str, sep=",").tolist()
            sim = cosine_similarity(q_emb, emb)
            scored.append((sim, title, chunk_text))
        except Exception:
            continue

    scored.sort(key=lambda x: x[0], reverse=True)
    top5 = scored[:5]

    if not top5:
        return {
            "answer": "I could not find relevant policy information. Please contact HR directly.",
            "sources": [],
        }

    context = "\n\n---\n\n".join([chunk for _, _, chunk in top5])

    # Deduplicate sources
    sources = []
    seen: set[str] = set()
    for _, title, chunk in top5:
        if title not in seen:
            sources.append({"title": title, "preview": chunk[:150] + "…"})
            seen.add(title)

    prompt = (
        "You are a knowledgeable and friendly HR assistant for Lumen HR. "
        "Your job is to answer ANY question an employee asks — about HR, work, policies, career, benefits, or general workplace topics.\n\n"
        "You have access to the following company policy documents. Use them when relevant:\n\n"
        f"{context}\n\n"
        "Guidelines:\n"
        "- ALWAYS give a helpful, complete answer. Never refuse to answer.\n"
        "- If the policy documents cover the topic, use that information first.\n"
        "- If the documents don't cover the topic, use your general HR knowledge to answer.\n"
        "- Be warm, professional, and concise (2-4 sentences max).\n"
        "- Never say 'I cannot help' or 'contact HR directly' — YOU are the HR assistant.\n"
        "- If you genuinely don't know something specific (like a person's salary), say so briefly and offer what you do know.\n\n"
        f"Employee question: {req.question}\n\nAnswer:"
    )

    try:
        answer = await chat(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b:free",
            max_tokens=500,
        )
    except Exception as e:
        logger.error(f"Policy chat LLM call failed: {e}")
        raise HTTPException(status_code=502, detail="AI service unavailable. Try again.")

    return {"answer": answer.strip(), "sources": sources[:3]}


@router.get("/policy/documents/")
async def list_policy_documents(
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin")),
):
    """List all unique uploaded policy documents (admin only)."""
    result = await db.execute(
        select(
            PolicyDocument.title,
            PolicyDocument.file_url,
            PolicyDocument.created_at,
        )
        .distinct(PolicyDocument.title)
        .order_by(PolicyDocument.title)
    )
    docs = result.all()
    return [
        {"title": d.title, "file_url": d.file_url, "created_at": str(d.created_at)}
        for d in docs
    ]


@router.delete("/policy/documents/{title}/")
async def delete_policy_document(
    title: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin")),
):
    """Delete all chunks for a given policy title."""
    result = await db.execute(select(PolicyDocument).where(PolicyDocument.title == title))
    docs = result.scalars().all()
    if not docs:
        raise HTTPException(status_code=404, detail="Policy document not found")
    for doc in docs:
        await db.delete(doc)
    await db.commit()
    return {"message": f"Deleted policy: {title}", "chunks_deleted": len(docs)}
