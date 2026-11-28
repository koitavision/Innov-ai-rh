"""GET /api/v1/rh/sources — the legal documents the assistant grounds its answers in."""

from api.rag.corpus import CORPUS_DIR, load_corpus
from api.rag.service import service
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class SourceDocument(BaseModel):
    file: str
    title: str
    kind: str
    articles: str
    source_url: str
    chars: int


class SourcesResponse(BaseModel):
    count: int
    chunks: int
    embedded: bool
    documents: list[SourceDocument]


@router.get(
    "",
    operation_id="rh_sources",
    summary="List the corpus documents (grouped per file)",
    response_model=SourcesResponse,
)
async def sources() -> SourcesResponse:
    chunks = service.chunks or load_corpus(CORPUS_DIR)
    grouped: dict[str, SourceDocument] = {}
    for chunk in chunks:
        grouped.setdefault(
            chunk.file,
            SourceDocument(
                file=chunk.file,
                title=chunk.title,
                kind=chunk.kind,
                articles="",
                source_url=chunk.source_url,
                chars=0,
            ),
        )
        document = grouped[chunk.file]
        grouped[chunk.file] = SourceDocument(
            file=document.file,
            title=chunk.title if chunk.title and "extrait" not in chunk.title else document.title,
            kind=document.kind,
            articles=document.articles,
            source_url=document.source_url or chunk.source_url,
            chars=document.chars + len(chunk.text),
        )
    return SourcesResponse(
        count=len(grouped),
        chunks=len(chunks),
        embedded=service.embedded,
        documents=sorted(grouped.values(), key=lambda document: document.file),
    )
