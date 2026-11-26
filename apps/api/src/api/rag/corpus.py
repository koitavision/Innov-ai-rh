"""Load the Malian legal corpus from ``apps/api/data/corpus`` and the system prompt.

Each corpus file is one Markdown chunk with a small YAML-like front-matter block delimited by
``---`` lines; values are JSON-encoded strings (see ``tools/corpus/build.py``).
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
CORPUS_DIR = DATA_DIR / "corpus"
SYSTEM_PROMPT_PATH = DATA_DIR / "system-prompt.md"

_FRONT_MATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


@dataclass(frozen=True)
class Chunk:
    file: str
    title: str
    source_url: str
    publisher: str
    kind: str
    articles: str
    text: str
    vector: list[float] = field(default_factory=list, compare=False)


def _parse_value(raw: str) -> str:
    raw = raw.strip()
    try:
        value = json.loads(raw)
        return value if isinstance(value, str) else raw
    except (ValueError, TypeError):
        return raw


def parse_document(path: Path) -> Chunk:
    content = path.read_text(encoding="utf-8")
    match = _FRONT_MATTER.match(content)
    meta: dict[str, str] = {}
    text = content
    if match:
        text = content[match.end() :]
        for line in match.group(1).splitlines():
            key, sep, value = line.partition(":")
            if sep:
                meta[key.strip()] = _parse_value(value)
    return Chunk(
        file=path.name,
        title=meta.get("title", path.stem),
        source_url=meta.get("source_url", ""),
        publisher=meta.get("publisher", ""),
        kind=meta.get("kind", "texte"),
        articles=meta.get("articles", ""),
        text=text.strip(),
    )


def load_corpus(corpus_dir: Path = CORPUS_DIR) -> list[Chunk]:
    """Every ``*.md`` in the corpus directory, sorted by file name for stable ordering."""
    if not corpus_dir.is_dir():
        raise FileNotFoundError(f"corpus directory missing: {corpus_dir}")
    return [parse_document(path) for path in sorted(corpus_dir.glob("*.md"))]


def load_system_prompt(path: Path = SYSTEM_PROMPT_PATH) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"system prompt missing: {path}")
    return path.read_text(encoding="utf-8").strip()
