"""AI Resume Screener — PDF extraction + OpenRouter analysis."""
import io
import logging

from pdfminer.high_level import extract_text

logger = logging.getLogger("hrms.ai")


def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract plain text from a PDF given as raw bytes."""
    try:
        return extract_text(io.BytesIO(pdf_bytes))
    except Exception as e:
        logger.warning(f"PDF text extraction failed: {e}")
        return ""


def extract_skills_spacy(text: str) -> list[str]:
    """Extract candidate skill keywords using spaCy noun chunks."""
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        doc = nlp(text[:5000])
        skills = list(set(
            chunk.text.lower()
            for chunk in doc.noun_chunks
            if len(chunk.text.strip()) > 2
        ))
        return skills[:30]
    except Exception as e:
        logger.warning(f"spaCy skill extraction failed: {e}")
        return []


async def screen_resume(pdf_bytes: bytes, job_description: str) -> dict:
    """
    Async resume screening via OpenRouter.
    Returns a dict with keys:
      overall_score, skills_matched, skills_missing,
      strengths, concerns, recommendation, summary
    """
    import asyncio
    from app.core.openrouter import chat_json, MODEL_SMART

    resume_text = await asyncio.to_thread(extract_text_from_bytes, pdf_bytes)
    skills      = await asyncio.to_thread(extract_skills_spacy, resume_text)

    prompt = f"""You are an expert HR recruiter. Analyze this resume against the job description.
Return ONLY a valid JSON object. No markdown, no backticks, no explanation outside the JSON.

Required keys:
- overall_score: integer 0-100
- skills_matched: array of strings
- skills_missing: array of strings
- strengths: array of 2-3 strings
- concerns: array of 1-2 strings
- recommendation: string (exactly one of: hire, maybe, reject)
- summary: string (max 2 sentences)

Job Description:
{job_description}

Resume:
{resume_text[:4000]}

Candidate skills detected: {', '.join(skills[:20])}"""

    return await chat_json(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL_SMART,
        max_tokens=1000,
    )
