"""The RAG service: embed the corpus once per process, retrieve chunks, answer with citations."""

import asyncio
import math
from collections.abc import Sequence

from api.rag.corpus import Chunk, load_corpus, load_system_prompt
from env.rh import env as rh_env
from mistralai.client import Mistral

_EMBED_BATCH = 64


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = math.fsum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(math.fsum(x * x for x in a))
    norm_b = math.sqrt(math.fsum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class RagService:
    """Holds the corpus and its embedding matrix; embeds lazily on the first request.

    Embedding needs a Mistral credential, which only exists inside a request (the gateway's
    caller token), so the cache fills on first use and lives for the process.
    """

    def __init__(self, chunks: list[Chunk] | None = None, system_prompt: str | None = None) -> None:
        self.chunks = chunks if chunks is not None else load_corpus()
        self.system_prompt = system_prompt if system_prompt is not None else load_system_prompt()
        self._lock = asyncio.Lock()
        self._embedded = False

    @property
    def embedded(self) -> bool:
        return self._embedded

    async def embed_texts(self, client: Mistral, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), _EMBED_BATCH):
            batch = texts[start : start + _EMBED_BATCH]
            response = await client.embeddings.create_async(model=rh_env.rh_embedding_model, inputs=batch)
            vectors.extend([list(item.embedding) for item in response.data])
        return vectors

    async def ensure_embedded(self, client: Mistral) -> None:
        if self._embedded:
            return
        async with self._lock:
            if self._embedded:
                return
            vectors = await self.embed_texts(client, [chunk.text for chunk in self.chunks])
            self.chunks = [
                Chunk(
                    file=chunk.file,
                    title=chunk.title,
                    source_url=chunk.source_url,
                    publisher=chunk.publisher,
                    kind=chunk.kind,
                    articles=chunk.articles,
                    text=chunk.text,
                    vector=vector,
                )
                for chunk, vector in zip(self.chunks, vectors)
            ]
            self._embedded = True

    def retrieve(self, query_vector: Sequence[float], top_k: int) -> list[tuple[Chunk, float]]:
        scored = [(_cosine(query_vector, chunk.vector), chunk) for chunk in self.chunks if chunk.vector]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [(chunk, score) for score, chunk in scored[: max(1, top_k)]]

    def build_context(self, hits: list[tuple[Chunk, float]], max_chars: int) -> str:
        parts: list[str] = []
        total = 0
        for chunk, score in hits:
            header = f"### {chunk.title}"
            if chunk.articles:
                header += f" ({chunk.articles})"
            header += f" — source : {chunk.source_url}"
            part = f"{header}\n{chunk.text}"
            if total + len(part) > max_chars and parts:
                break
            parts.append(part)
            total += len(part)
        return "\n\n".join(parts)

    async def answer(
        self,
        client: Mistral,
        messages: list[dict[str, str]],
        top_k: int,
    ) -> tuple[str, list[tuple[Chunk, float]], str]:
        """Answer the last user message, grounded in the corpus; returns (text, citations, model)."""
        await self.ensure_embedded(client)
        query = messages[-1]["content"]
        query_vector = (await self.embed_texts(client, [query]))[0]
        hits = self.retrieve(query_vector, top_k)
        context = self.build_context(hits, rh_env.rh_max_context_chars)
        system = f"{self.system_prompt}\n{context}"
        history = messages[:-1][-rh_env.rh_history_limit :]
        chat_messages = [{"role": "system", "content": system}]
        chat_messages.extend({"role": message["role"], "content": message["content"]} for message in history)
        chat_messages.append({"role": "user", "content": query})
        response = await client.chat.complete_async(
            model=rh_env.rh_model,
            messages=chat_messages,
            temperature=0.2,
            max_tokens=2048,
        )
        choice = response.choices[0]
        text = choice.message.content
        if isinstance(text, list):
            text = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in text)
        return str(text), hits, rh_env.rh_model


service = RagService()
