from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings


class LLMClient(Protocol):
    model: str

    def chat(self, system: str, user: str) -> str: ...

    def health(self) -> dict: ...


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def chat(self, system: str, user: str) -> str:
        r = httpx.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "stream": False,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "options": {"temperature": 0.1, "num_ctx": 4096},
                "keep_alive": "30m",
            },
            timeout=self.timeout,
        )
        r.raise_for_status()
        return r.json()["message"]["content"]

    def health(self) -> dict:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=3)
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
            ready = any(m == self.model or m.split(":")[0] == self.model for m in models)
            return {"status": "ready" if ready else "model_not_pulled", "models": models}
        except Exception as e:
            return {"status": "unavailable", "error": type(e).__name__}


@lru_cache
def get_llm() -> LLMClient | None:
    if settings.llm_provider == "ollama":
        return OllamaClient(settings.ollama_base_url, settings.llm_model, settings.llm_timeout)
    return None
