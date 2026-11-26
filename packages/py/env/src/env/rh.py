"""Settings of the Malian HR assistant: the chat model, the embedding model, and the RAG knobs."""

from env._base import BaseEnv


class Env(BaseEnv):
    rh_model: str = "mistral-large-latest"
    rh_embedding_model: str = "mistral-embed"
    rh_top_k: int = 8
    rh_max_context_chars: int = 24000
    rh_history_limit: int = 8


env = Env()
