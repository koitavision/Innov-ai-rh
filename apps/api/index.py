"""Vercel serverless entry for the Innov AI RH API.

Standalone ASGI app that reuses the RAG service and corpus of apps/api but authenticates
against the Mistral API with MISTRAL_API_KEY, since Vercel has no Mistral Apps gateway to
provide a caller token. Routes mirror apps/api/src/api/routers/api/v1/rh.

With ``web: true``, a "veille" pass first asks Mistral's Conversations API — its
``web_search`` tool — for recent public information; the findings are injected into the
grounded answer as clearly-labelled non-official context, and their sources are returned
apart from the legal citations.
"""

import json
import os
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent
for entry in (str(_SRC / "src"), str(_SRC)):
    if entry not in sys.path:
        sys.path.insert(0, entry)

from fastapi import FastAPI, HTTPException  # noqa: E402
from mistralai.client import Mistral  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from typing import Literal  # noqa: E402

from api.rag.service import service  # noqa: E402
from api.routers.api.v1.rh.sources import router as sources_router  # noqa: E402
from api.routers.api.v1.rh.status import router as status_router  # noqa: E402

app = FastAPI(title="INNOV RH Mali", docs_url=None, redoc_url=None, openapi_url=None)

VEILLE_MODEL = os.environ.get("RH_VEILLE_MODEL", "mistral-small-latest")

VEILLE_INSTRUCTIONS = (
    "Tu es un agent de veille juridique sur le droit du travail et les ressources humaines "
    "au Mali. Cherche sur le web les informations récentes et pertinentes pour la question "
    "(nouveaux décrets, arrêtés, projets de loi, actualités officielles, chiffres à jour). "
    "Réponds en français en 3 à 6 lignes factuelles : ce qui est récent, avec les dates, et "
    "ce qui pourrait modifier les textes en vigueur. Si rien de récent n'existe, dis-le "
    "brièvement. Fais ta recherche, ne paraphrase pas la question."
)


def _mistral_client() -> Mistral:
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="MISTRAL_API_KEY is not configured.")
    return Mistral(api_key=api_key)


def _chunk_text(content) -> str:
    """Join the text chunks of a message content, dropping the reasoning ones."""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for part in content:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            value = part.get("text", "")
            parts.append(value if isinstance(value, str) else "")
        else:
            value = getattr(part, "text", None)
            if isinstance(value, str):
                parts.append(value)
    return "".join(parts)


async def run_web_veille(client: Mistral, question: str) -> tuple[str, list[dict[str, str]]]:
    """One Conversations API turn with the ``web_search`` tool; returns (findings, sources)."""
    response = await client.beta.conversations.start_async(
        model=VEILLE_MODEL,
        inputs=question,
        instructions=VEILLE_INSTRUCTIONS,
        tools=[{"type": "web_search"}],
    )
    findings = ""
    sources: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in getattr(response, "outputs", None) or []:
        kind = getattr(entry, "type", None)
        if kind == "tool.execution" and getattr(entry, "name", None) == "web_search":
            info = getattr(entry, "info", None)
            result = info.get("result") if isinstance(info, dict) else getattr(info, "result", None)
            if not isinstance(result, str):
                continue
            try:
                parsed: object = json.loads(result)
            except ValueError:
                continue
            if not isinstance(parsed, dict):
                continue
            for item in parsed.values():
                if isinstance(item, dict) and isinstance(item.get("url"), str):
                    url = item["url"]
                    if url in seen:
                        continue
                    seen.add(url)
                    title = str(item.get("title") or url).strip()[:140]
                    sources.append({"title": title, "url": url})
        elif kind == "message.output":
            text = _chunk_text(getattr(entry, "content", None))
            if text:
                findings = text
    return findings, sources


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=20)
    web: bool = False


class Citation(BaseModel):
    file: str
    title: str
    articles: str
    source_url: str
    score: float


class WebSource(BaseModel):
    title: str
    url: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    web_sources: list[WebSource]
    model: str


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/rh/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    messages = [message.model_dump() for message in request.messages]
    if messages[-1]["role"] != "user":
        raise HTTPException(status_code=422, detail="The last message must come from the user.")
    client = _mistral_client()
    question = messages[-1]["content"]

    extra_context = ""
    web_sources: list[WebSource] = []
    if request.web:
        try:
            findings, sources = await run_web_veille(client, question)
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001 - web veille is an enhancement, never a hard failure
            findings, sources = "", []
        web_sources = [WebSource(title=source["title"], url=source["url"]) for source in sources]
        if findings:
            listing = "\n".join(f"- {source['title']} — {source['url']}" for source in sources)
            extra_context = (
                "### VEILLE WEB — informations récentes NON OFFICIELLES (à vérifier)\n"
                f"{findings}\n\nSources web consultées :\n{listing}\n"
                "Utilise ces éléments seulement pour signaler ce qui est récent ou a changé ; "
                "fonde toujours la réponse sur les textes officiels du corpus ci-dessus, et "
                "mentionne que les éléments de veille doivent être vérifiés au Journal officiel."
            )

    try:
        answer, hits, model = await service.answer(
            client, messages, request.top_k or 8, extra_context=extra_context
        )
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001 - surface SDK failures to the caller
        raise HTTPException(status_code=502, detail=f"Mistral API error: {error}") from error
    return ChatResponse(
        answer=answer,
        citations=[
            Citation(
                file=chunk.file,
                title=chunk.title,
                articles=chunk.articles,
                source_url=chunk.source_url,
                score=round(score, 4),
            )
            for chunk, score in hits
        ],
        web_sources=web_sources,
        model=model,
    )


app.include_router(sources_router, prefix="/api/v1/rh/sources")
app.include_router(status_router, prefix="/api/v1/rh/status")
