from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class MistralService:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("MISTRAL_API_KEY") or getattr(
            settings, "MISTRAL_API_KEY", ""
        )
        self.model = model or getattr(settings, "MISTRAL_MODEL", "mistral-small-latest")

    def _chat(self, system: str, user: str, temperature: float = 0.2) -> str:
        if not self.api_key:
            return ""
        try:
            from mistralai.client import Mistral

            client = Mistral(api_key=self.api_key)
            resp = client.chat.complete(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
            )
            msg = resp.choices[0].message
            content = getattr(msg, "content", None) if msg is not None else None
            return (content or "").strip()
        except Exception as exc:
            logger.warning("Mistral API error: %s", exc)
            return ""

    def extract_nl_preferences(self, text: str) -> dict[str, Any]:
        system = (
            "You extract structured movie taste preferences. "
            "Reply with ONLY valid JSON: "
            '{"mood":"...","lead_characters":[],"themes":[],"eras":[],"avoid":[]}'
        )
        raw = self._chat(system, f"User text:\n{text}")
        return self._parse_json(raw) or {}

    def explain_recommendation(
        self,
        movie_title: str,
        movie_summary: str,
        liked_titles: list[str],
        genre_overlap: list[str],
    ) -> str:
        system = (
            "You write concise personalized explanations for movie recommendations. "
            "Exactly two sentences. Reference user history naturally."
        )
        user = (
            f"Movie: {movie_title}\nSummary: {movie_summary[:400]}\n"
            f"Liked before: {', '.join(liked_titles[:8])}\n"
            f"Genre overlap: {', '.join(genre_overlap)}"
        )
        text = self._chat(system, user, temperature=0.35)
        if not text:
            return (
                f"Recommended because it aligns with genres you enjoy "
                f"({', '.join(genre_overlap[:3]) or 'your taste'}) and themes similar to titles you rated highly."
            )
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        return " ".join(sentences[:2]).strip()

    def taste_evolution_summary(self, rating_lines: list[str]) -> str:
        system = (
            "Summarize how this user's movie taste is evolving in 3-4 sentences. "
            "Be warm and specific about genres and moods."
        )
        body = "\n".join(rating_lines[-40:])
        text = self._chat(system, body, temperature=0.4)
        return text or "Your ratings show steady curiosity across genres."

    def relevance_score(self, user_context: str, movie_title: str, movie_summary: str) -> float:
        system = (
            "Score how well this movie fits the user's taste from 0 to 10. "
            "Reply with ONLY a number 0-10, no words."
        )
        user = f"User context:\n{user_context[:1200]}\n\nMovie: {movie_title}\n{movie_summary[:600]}"
        raw = self._chat(system, user, temperature=0.1)
        m = re.search(r"(\d+(?:\.\d+)?)", raw)
        if not m:
            return 0.55
        val = float(m.group(1))
        return max(0.0, min(1.0, val / 10.0))

    def discovery_chat_turn(
        self,
        history: list[dict[str, str]],
        catalog_hint: str,
    ) -> dict[str, Any]:
        system = (
            "You help users discover movies. Ask 2-3 short clarifying questions total across the conversation. "
            "When you have enough signal, reply with JSON ONLY: "
            '{"done":true,"summary":"...","suggested_genres":[],"avoid":[]} '
            "Otherwise reply with plain text (questions)."
        )
        msgs = "\n".join(f'{m["role"]}: {m["content"]}' for m in history[-12:])
        user = f"Conversation:\n{msgs}\n\nCatalog snapshot:\n{catalog_hint[:800]}"
        raw = self._chat(system, user, temperature=0.45)
        parsed = self._parse_json(raw)
        if parsed and parsed.get("done"):
            return parsed
        return {"done": False, "message": raw or "What mood are you in tonight?"}

    def batch_relevance_scores(
        self,
        user_context: str,
        items: list[tuple[str, str]],
    ) -> list[float]:
        if not self.api_key or not items:
            return [0.55] * len(items)
        scores: list[float] = []
        for title, summary in items[:30]:
            scores.append(self.relevance_score(user_context, title, summary))
        while len(scores) < len(items):
            scores.append(0.55)
        return scores[: len(items)]

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any] | None:
        if not text:
            return None
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
        return None
