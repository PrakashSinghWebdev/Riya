"""Real-time internet research + summarization.

Searches the web (DuckDuckGo, no API key) and asks the brain to synthesize a
concise answer with the snippets as context. Falls back gracefully if search or
the brain is unavailable.
"""

from __future__ import annotations

from .brain import brain

try:
    from ddgs import DDGS

    _DDGS_OK = True
except Exception:  # pragma: no cover
    try:
        from duckduckgo_search import DDGS  # older package name

        _DDGS_OK = True
    except Exception:
        DDGS = None  # type: ignore[assignment]
        _DDGS_OK = False


def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Return [{title, body, href}] for a query, or [] on failure."""
    if not _DDGS_OK or not query.strip():
        return []
    try:
        with DDGS() as ddgs:
            return [
                {"title": r.get("title", ""), "body": r.get("body", ""), "href": r.get("href", "")}
                for r in ddgs.text(query, max_results=max_results)
            ]
    except Exception:
        return []


def research(query: str, max_results: int = 5) -> dict:
    """Search the web and summarize an answer. Returns {answer, sources, online}."""
    query = (query or "").strip()
    if not query:
        return {"answer": "", "sources": [], "online": brain.online}

    results = web_search(query, max_results)
    sources = [{"title": r["title"], "href": r["href"]} for r in results if r["href"]]

    if not results:
        return {
            "answer": "I couldn't reach the web just now — check the internet connection.",
            "sources": [],
            "online": brain.online,
        }

    context = "\n\n".join(
        f"[{i + 1}] {r['title']}\n{r['body']}\n{r['href']}" for i, r in enumerate(results)
    )
    prompt = (
        "Use the web search results below to answer the user's question concisely "
        "(2-4 sentences). Cite source numbers like [1] where relevant. If the "
        "results don't answer it, say so.\n\n"
        f"Question: {query}\n\nResults:\n{context}"
    )
    if not brain.online:
        # No LLM — return the top snippets directly.
        top = "\n".join(f"• {r['title']}: {r['body'][:160]}" for r in results[:3])
        return {"answer": f"Top results for “{query}”:\n{top}", "sources": sources, "online": False}

    try:
        out = brain.respond([{"role": "user", "content": prompt}], mode_key="agent")
        return {"answer": out["reply"], "sources": sources, "online": True}
    except Exception:
        # Brain unreachable — still give the user the raw findings.
        top = "\n".join(f"• {r['title']}: {r['body'][:160]}" for r in results[:3])
        return {"answer": f"Top results for “{query}”:\n{top}", "sources": sources, "online": False}
