"""OpenRouter unified AI client — replaces direct Gemini and Groq SDKs."""
import json
import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger("hrms.ai.openrouter")

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# ── Working free models (verified 2026-06-05) ────────────────────────────────
# Primary: openai/gpt-oss-120b:free  — best quality, most capable
# Fast:    google/gemma-4-31b-it:free — good for structured tasks
# Backup:  moonshotai/kimi-k2.6:free — reliable fallback
MODEL_SMART     = "openai/gpt-oss-120b:free"
MODEL_FAST      = "google/gemma-4-31b-it:free"
MODEL_INTERVIEW = "openai/gpt-oss-120b:free"
MODEL_POLICY    = "moonshotai/kimi-k2.6:free"

# Fallback chain — tried in order if primary fails
_FALLBACK_MODELS = [
    "openai/gpt-oss-120b:free",
    "google/gemma-4-31b-it:free",
    "moonshotai/kimi-k2.6:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
]


async def chat(
    messages: list[dict],
    model: str = MODEL_SMART,
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Send a chat completion request to OpenRouter.
    Returns the assistant message content as a string.
    Automatically falls back to next model if provider returns an error.
    """
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "HRMS-AI",
    }
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    # Build the list of models to try: requested model first, then fallbacks
    models_to_try = [model] + [m for m in _FALLBACK_MODELS if m != model]
    last_error = None

    async with httpx.AsyncClient(timeout=90) as client:
        for attempt_model in models_to_try:
            try:
                body["model"] = attempt_model
                resp = await client.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=headers,
                    json=body,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    if attempt_model != model:
                        logger.info("AI fallback used: %s → %s", model, attempt_model)
                    return content.strip()

                # Provider error or rate limit — try next model
                error_msg = resp.json().get("error", {}).get("message", resp.text[:120])
                logger.warning("Model %s failed (%s): %s", attempt_model, resp.status_code, error_msg)
                last_error = error_msg

            except httpx.TimeoutException:
                logger.warning("Model %s timed out", attempt_model)
                last_error = "timeout"
                continue

    raise RuntimeError(f"All AI models failed. Last error: {last_error}")


def _extract_json(raw: str) -> str:
    """
    Robustly extract a JSON object/array from a model response that may contain:
    - <think>...</think> or <thinking>...</thinking> reasoning blocks
    - Markdown code fences: ```json...``` or ```...```
    - Preamble text before the actual JSON
    """
    # 1. Strip <think> / <thinking> blocks (reasoning models: Kimi, DeepSeek, etc.)
    raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r'<thinking>.*?</thinking>', '', raw, flags=re.DOTALL | re.IGNORECASE)
    raw = raw.strip()

    # 2. Extract from markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            json.loads(candidate)  # validate before returning
            return candidate
        except json.JSONDecodeError:
            pass  # fall through to bracket search

    # 3. Find the first { or [ and extract to matching close bracket
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start_idx = raw.find(start_char)
        if start_idx == -1:
            continue
        depth = 0
        in_string = False
        escape_next = False
        for i, ch in enumerate(raw[start_idx:], start_idx):
            if escape_next:
                escape_next = False
                continue
            if ch == '\\' and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    candidate = raw[start_idx:i + 1]
                    try:
                        json.loads(candidate)
                        return candidate
                    except json.JSONDecodeError:
                        break  # malformed — try next start_char

    # 4. Last resort: return raw stripped (will likely fail JSON parse, surfacing the error)
    return raw.strip()


async def chat_json(
    messages: list[dict],
    model: str = MODEL_SMART,
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> dict | list:
    """
    Like chat() but robustly extracts and parses JSON from the model response.
    Handles <think> blocks, code fences, and preamble text automatically.
    Raises json.JSONDecodeError if all extraction attempts fail.
    """
    raw = await chat(messages, model=model, max_tokens=max_tokens, temperature=temperature)
    cleaned = _extract_json(raw)
    return json.loads(cleaned)
