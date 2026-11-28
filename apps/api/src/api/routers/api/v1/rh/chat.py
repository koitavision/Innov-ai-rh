"""POST /api/v1/rh/chat — ask the Malian HR expert; the answer cites the legal corpus."""

from typing import Literal

from api.rag.service import service
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from utils.mistral import MistralNotConfiguredError, caller_mistral_client

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=20)


class Citation(BaseModel):
    file: str
    title: str
    articles: str
    source_url: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    model: str


@router.post(
    "",
    operation_id="rh_chat",
    summary="Ask the Malian HR expert (RAG over the legal corpus)",
    response_model=ChatResponse,
)
async def chat(request: ChatRequest) -> ChatResponse:
    """Answer the last user message with the corpus as grounding, returning the citations used."""
    messages = [message.model_dump() for message in request.messages]
    if messages[-1]["role"] != "user":
        raise HTTPException(status_code=422, detail="The last message must come from the user.")
    try:
        client = caller_mistral_client()
        answer, hits, model = await service.answer(client, messages, request.top_k or 8)
    except MistralNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
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
        model=model,
    )
