"""Tests for the Malian HR RAG assistant: corpus, retrieval, and the chat route."""

import re
from dataclasses import replace
from types import SimpleNamespace

import pytest
from api.rag.corpus import CORPUS_DIR, load_corpus, load_system_prompt, parse_document
from api.rag.service import RagService
from api.routers.api.v1.rh import chat as chat_module
from fastapi.testclient import TestClient
from conftest import build_app

KEYWORDS = ["durée légale du travail ne peut", "préavis", "SMIG", "indemnité de licenciement"]


def fake_vector(text: str) -> list[float]:
    lowered = re.sub(r"\s+", " ", text).lower()
    return [1.0 if keyword.lower() in lowered else 0.0 for keyword in KEYWORDS]


class FakeEmbeddings:
    async def create_async(self, *, model: str, inputs: list[str], **kwargs: object) -> object:
        return SimpleNamespace(data=[SimpleNamespace(embedding=fake_vector(text)) for text in inputs])


class FakeChat:
    async def complete_async(self, *, model: str, messages: list[dict[str, str]], **kwargs: object) -> object:
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="Réponse de test, art. 131 du Code du travail."))]
        )


class FakeClient:
    def __init__(self) -> None:
        self.embeddings = FakeEmbeddings()
        self.chat = FakeChat()


@pytest.fixture
def app() -> object:
    return build_app()


def test_corpus_loads_with_front_matter() -> None:
    chunks = load_corpus(CORPUS_DIR)
    assert len(chunks) >= 50
    for chunk in chunks:
        assert chunk.title
        assert len(chunk.text) > 100
        assert chunk.source_url.startswith("http")
    prompt = load_system_prompt()
    assert "Mali" in prompt


def test_parse_document_reads_front_matter() -> None:
    path = next(CORPUS_DIR.glob("code-du-travail-consolide-*.md"))
    chunk = parse_document(path)
    assert chunk.kind == "loi"
    assert chunk.title.startswith("Code du travail")
    assert "sgg-mali.ml" in chunk.source_url


def test_retrieval_ranks_the_relevant_chunk_first() -> None:
    service = RagService(chunks=load_corpus(CORPUS_DIR), system_prompt="prompt")
    service.chunks = [replace(chunk, vector=fake_vector(chunk.text)) for chunk in service.chunks]
    hits = service.retrieve([1.0, 0.0, 0.0, 0.0], top_k=5)
    assert hits
    assert "durée légale du travail ne peut" in hits[0][0].text


def test_chat_answers_with_citations(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    service = chat_module.service
    service.chunks = [replace(chunk, vector=fake_vector(chunk.text)) for chunk in service.chunks]
    service._embedded = True
    monkeypatch.setattr(service, "embed_texts", lambda client, texts: _async_fake(texts))
    monkeypatch.setattr(chat_module, "caller_mistral_client", lambda: FakeClient())

    response = client.post(
        "/api/v1/rh/chat",
        json={"messages": [{"role": "user", "content": "La durée légale du travail ne peut excéder combien d'heures par semaine au Mali ?"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["answer"].startswith("Réponse de test")
    assert data["citations"]
    assert data["citations"][0]["file"].startswith("code-du-travail-consolide")
    assert data["model"]


def test_chat_rejects_a_last_message_not_from_the_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/rh/chat",
        json={"messages": [{"role": "user", "content": "Bonjour"}, {"role": "assistant", "content": "Salut"}]},
    )
    assert response.status_code == 422


def test_chat_rejects_an_empty_history(client: TestClient) -> None:
    response = client.post("/api/v1/rh/chat", json={"messages": []})
    assert response.status_code == 422


def test_sources_and_status_endpoints(client: TestClient) -> None:
    sources = client.get("/api/v1/rh/sources")
    assert sources.status_code == 200
    assert sources.json()["count"] >= 10
    assert sources.json()["chunks"] >= 50
    status = client.get("/api/v1/rh/status")
    assert status.status_code == 200
    assert status.json()["chunks"] >= 50


async def _async_fake(texts: list[str]) -> list[list[float]]:
    return [fake_vector(text) for text in texts]
