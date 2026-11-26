"""Build the Malian HR legal corpus for the RAG app.

Downloads the official PDFs listed in ``sources.json`` into ``corpus/raw/`` (skipping ones
already present), extracts their text, and writes:

- ``corpus/full/<slug>.md``: the full extracted text, one Markdown document per source
  (mirrored into the Studio document library);
- ``apps/api/data/corpus/<slug>-NNN.md``: chunks of at most ``CHUNK_CHARS`` characters, split on
  article boundaries when the source has them, each with provenance front-matter (what the RAG
  app embeds and cites).

Usage: ``uv run --with pypdf python tools/corpus/build.py`` from the repo root.
"""

import json
import re
import socket
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tools/corpus/sources.json"
RAW = ROOT / "corpus/raw"
FULL = ROOT / "corpus/full"
CHUNKS = ROOT / "apps/api/data/corpus"

CHUNK_CHARS = 5200
MIN_CHUNK_CHARS = 400

socket.setdefaulttimeout(60)

ARTICLE_SPLIT = re.compile(r"(?=^Art(?:icle)?\.?\s*[LD]?\.?\s*\d)", re.MULTILINE)
HEADER_SPLIT = re.compile(r"(?=^(?:Titre|Chapitre|Section|Sous-section|Sous-?Section)\b)", re.MULTILINE | re.IGNORECASE)
# A legal act inside a Journal officiel issue: from its heading to the next act's heading.
ACT_HEAD = re.compile(r"(?m)^(LOI|ORDONNANCE|D[ÉE]CRET|ARR[ÊE]T[ÉE]|AVIS)\s+N[°o]", re.IGNORECASE)


def extract_act(text: str, needle: str) -> str:
    """Cut the act containing ``needle`` out of a whole JO issue.

    The sommaire also names acts, so among every act-section that mentions the needle the
    longest one is the act's body, not its one-line sommaire entry.
    """
    heads = list(ACT_HEAD.finditer(text))
    best = ""
    for i, head in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        section = text[head.start() : end]
        if needle.lower() in section.lower() and len(section) > len(best):
            best = section
    if not best:
        raise ValueError(f"no act containing {needle!r} found")
    return best.strip() + "\n"


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 10_000:
        print(f"  cached {dest.name}")
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"})
    data = urllib.request.urlopen(req).read()
    dest.write_bytes(data)
    print(f"  downloaded {dest.name} ({len(data) // 1024} KB)")


def extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    text = "\n\n".join(pages)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def clean(text: str) -> str:
    text = text.replace("\uf0b7", "- ").replace("\u00ad", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip() + "\n"


def chunk(text: str) -> list[str]:
    parts = ARTICLE_SPLIT.split(text)
    if len(parts) <= 1:
        parts = HEADER_SPLIT.split(text)
    chunks: list[str] = []
    current = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(current) + len(part) + 2 > CHUNK_CHARS and len(current) >= MIN_CHUNK_CHARS:
            chunks.append(current)
            current = part
        else:
            current = f"{current}\n\n{part}" if current else part
    if current.strip():
        chunks.append(current)
    if len(chunks) > 1 and len(chunks[-1]) < MIN_CHUNK_CHARS:
        chunks[-2] = f"{chunks[-2]}\n\n{chunks[-1]}"
        chunks.pop()
    return chunks


def article_range(text: str) -> str:
    arts = re.findall(r"^Art(?:icle)?\.?\s*[LD]?\.?\s*\d+", text, re.MULTILINE)
    if not arts:
        heads = re.findall(r"^(?:Titre|Chapitre|Section|Sous-?Section)\b[^\n]*", text, re.MULTILINE | re.IGNORECASE)
        return " ; ".join(h.strip()[:60] for h in heads[:3])
    return f"{arts[0].strip()} ... {arts[-1].strip()}"


def front_matter(title: str, source: dict, extra: str) -> str:
    return (
        "---\n"
        f"title: {json.dumps(title, ensure_ascii=False)}\n"
        f"source_url: {json.dumps(source['url'], ensure_ascii=False)}\n"
        f"publisher: {json.dumps(source.get('publisher', ''), ensure_ascii=False)}\n"
        f"kind: {source.get('kind', 'texte')}\n"
        f"{extra}"
        "---\n\n"
    )


def main() -> int:
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))["sources"]
    RAW.mkdir(parents=True, exist_ok=True)
    FULL.mkdir(parents=True, exist_ok=True)
    CHUNKS.mkdir(parents=True, exist_ok=True)
    for old in CHUNKS.glob("*-???.md"):
        old.unlink()

    manifest = []
    for source in sources:
        slug = source["slug"]
        print(f"[{slug}] {source['url']}")
        try:
            pdf = RAW / f"{slug}.pdf"
            download(source["url"], pdf)
            text = clean(extract_pdf(pdf))
            if source.get("contains"):
                text = clean(extract_act(text, source["contains"]))
        except Exception as error:  # noqa: BLE001 - report and continue with the other sources
            print(f"  ERROR: {type(error).__name__}: {error}")
            continue
        full_md = front_matter(source["title"], source, "") + text
        (FULL / f"{slug}.md").write_text(full_md, encoding="utf-8")
        parts = chunk(text)
        written = 0
        for i, part in enumerate(parts, 1):
            doc = front_matter(
                f"{source['title']} — extrait {i}/{len(parts)}",
                source,
                f"extrait: {i}/{len(parts)}\narticles: {json.dumps(article_range(part), ensure_ascii=False)}\n",
            ) + part + "\n"
            (CHUNKS / f"{slug}-{i:03d}.md").write_text(doc, encoding="utf-8")
            written += 1
        total_chars = sum(len(p) for p in parts)
        print(f"  -> full text {len(text) // 1024} KB, {written} chunks, {total_chars} chars")
        manifest.append({"slug": slug, "title": source["title"], "url": source["url"], "chunks": written, "chars": total_chars})

    (CHUNKS / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done: {len(manifest)} sources")
    return 0 if manifest else 1


if __name__ == "__main__":
    sys.exit(main())
