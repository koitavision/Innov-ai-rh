"""GET /api/v1/rh/status — corpus size, embedding state and model configuration."""

from api.rag.service import service
from env.rh import env as rh_env
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class StatusResponse(BaseModel):
    chunks: int
    embedded: bool
    model: str
    embedding_model: str
    top_k: int


@router.get(
    "",
    operation_id="rh_status",
    summary="Corpus and model status of the RH assistant",
    response_model=StatusResponse,
)
async def status() -> StatusResponse:
    return StatusResponse(
        chunks=len(service.chunks),
        embedded=service.embedded,
        model=rh_env.rh_model,
        embedding_model=rh_env.rh_embedding_model,
        top_k=rh_env.rh_top_k,
    )
