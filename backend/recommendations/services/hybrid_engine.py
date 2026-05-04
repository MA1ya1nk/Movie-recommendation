from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Sequence

import numpy as np
from django.contrib.auth import get_user_model
from django.db.models import Count, QuerySet
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

from catalog.models import Movie
from engagement.models import ABVariant, Rating, UserProfile
from recommendations.services.chroma_store import ChromaMovieStore
from recommendations.services.diversity import apply_diversity_filter, freshness_multiplier
from recommendations.services.mistral_client import MistralService

logger = logging.getLogger(__name__)
User = get_user_model()

DEFAULT_WEIGHTS = {
    "content_w": 0.35,
    "collab_w": 0.30,
    "popularity_w": 0.15,
    "mistral_w": 0.20,
}


def _csr_scalar_f(mat: csr_matrix, row: int, col: int) -> float:
    """One sparse cell as a plain float (avoids boolean ambiguity on matrix slices)."""
    return float(np.asarray(mat[row, col], dtype=np.float64).ravel()[0])


@dataclass
class ScoredMovie:
    movie: Movie
    final_score: float
    content_score: float
    collab_score: float
    popularity_score: float
    mistral_score: float


class HybridRecommendationEngine:
    def __init__(self) -> None:
        self.chroma = ChromaMovieStore()
        self.mistral = MistralService()

    def _weights_for_user(self, user) -> dict[str, float]:
        profile = getattr(user, "profile", None)
        variant = getattr(profile, "ab_variant", None)
        if variant:
            return {
                "content_w": variant.content_w,
                "collab_w": variant.collab_w,
                "popularity_w": variant.popularity_w,
                "mistral_w": variant.mistral_w,
            }
        return DEFAULT_WEIGHTS.copy()

    def rating_count(self, user) -> int:
        return Rating.objects.filter(user=user).count()

    def is_cold_start(self, user) -> bool:
        return self.rating_count(user) < 3

    def _popularity_map(self, movies: QuerySet[Movie] | list[Movie]) -> dict[int, float]:
        if isinstance(movies, QuerySet):
            qs = movies
        else:
            ids = [m.pk for m in movies]
            qs = Movie.objects.filter(pk__in=ids)
        scores = {}
        max_pop = max((m.popularity_score or 0.0) for m in qs) or 1.0
        for m in qs:
            scores[m.pk] = float(m.popularity_score or 0.0) / max_pop
        return scores

    def _collaborative_scores(
        self,
        user,
        candidate_ids: Sequence[int],
        top_k_users: int = 40,
    ) -> dict[int, float]:
        if not candidate_ids:
            return {}
        ratings = Rating.objects.values_list("user_id", "movie_id", "stars")
        rows: list[int] = []
        cols: list[int] = []
        data: list[float] = []
        user_index: dict[int, int] = {}
        movie_index: dict[int, int] = {}
        for uid, mid, stars in ratings:
            if uid not in user_index:
                user_index[uid] = len(user_index)
            if mid not in movie_index:
                movie_index[mid] = len(movie_index)
            rows.append(user_index[uid])
            cols.append(movie_index[mid])
            data.append(float(stars))

        if user.id not in user_index or not movie_index:
            return {mid: 0.5 for mid in candidate_ids}

        mat = csr_matrix((data, (rows, cols)), shape=(len(user_index), len(movie_index)))
        u_idx = user_index[user.id]
        sims = np.asarray(cosine_similarity(mat[u_idx], mat)[0], dtype=np.float64).ravel()
        neighbor_indices = np.argsort(-sims)[1 : top_k_users + 1]

        scores: dict[int, float] = {mid: 0.5 for mid in candidate_ids}
        for cid in candidate_ids:
            if cid not in movie_index:
                continue
            col = movie_index[cid]
            num = 0.0
            den = 0.0
            for ni in neighbor_indices:
                if ni == u_idx:
                    continue
                w = float(sims[ni])
                if w <= 0:
                    continue
                rating_val = _csr_scalar_f(mat, ni, col)
                if rating_val != 0.0:
                    num += w * rating_val
                    den += abs(w)
            if den > 0:
                scores[cid] = max(0.0, min(1.0, (num / den) / 5.0))
        return scores

    def _content_scores(
        self,
        user,
        candidate_ids: Sequence[int],
    ) -> dict[int, float]:
        liked = (
            Rating.objects.filter(user=user, stars__gte=4)
            .select_related("movie")
            .order_by("-stars")[:5]
        )
        seeds = [r.movie for r in liked]
        if not seeds:
            prefs = getattr(getattr(user, "profile", None), "nl_preferences", {}) or {}
            seed_text = " ".join(
                [
                    str(prefs.get("mood", "")),
                    " ".join(prefs.get("themes", []) or []),
                ]
            ).strip()
            if not seed_text:
                return {mid: 0.5 for mid in candidate_ids}
            similar = self.chroma.query_similar(None, seed_text, top_k=len(candidate_ids) + 10)
        else:
            agg_scores: dict[int, list[float]] = {}
            for sm in seeds:
                similar = self.chroma.query_similar(
                    sm.pk,
                    None,
                    top_k=40,
                    exclude_ids=[sm.pk],
                )
                for mid, s in similar:
                    agg_scores.setdefault(mid, []).append(s)
            similar = [
                (mid, float(np.mean(vals))) for mid, vals in agg_scores.items()
            ]
            similar.sort(key=lambda x: -x[1])

        score_map = {mid: 0.45 for mid in candidate_ids}
        for mid, sc in similar:
            if mid in candidate_ids:
                score_map[mid] = max(score_map.get(mid, 0.0), sc)
        return score_map

    def _mistral_scores_map(
        self,
        user,
        movies_list: list[Movie],
    ) -> dict[int, float]:
        prefs = getattr(getattr(user, "profile", None), "nl_preferences", {}) or {}
        liked = list(
            Rating.objects.filter(user=user)
            .select_related("movie")
            .order_by("-stars")[:12]
        )
        lines = [
            f"{r.movie.title} ({r.stars})" for r in liked
        ]
        ctx = (
            f"Mood: {prefs.get('mood','')}. Themes: {prefs.get('themes','')}.\n"
            f"Recent ratings: {', '.join(lines)}"
        )
        items = [(m.title, m.summary) for m in movies_list]
        scores_list = self.mistral.batch_relevance_scores(ctx, items)
        out: dict[int, float] = {}
        for m, sc in zip(movies_list, scores_list):
            out[m.pk] = sc
        return out

    def score_candidates(
        self,
        user,
        candidates: QuerySet[Movie],
        apply_filters: bool = True,
        limit: int = 24,
    ) -> tuple[list[ScoredMovie], dict[str, float]]:
        weights = self._weights_for_user(user)
        cand_list = list(candidates[: max(limit * 4, 80)])
        if not cand_list:
            return [], weights

        ids = [m.pk for m in cand_list]
        pop_map = self._popularity_map(cand_list)
        collab_map = self._collaborative_scores(user, ids)
        content_map = self._content_scores(user, ids)
        mistral_map = self._mistral_scores_map(user, cand_list)

        scored: list[ScoredMovie] = []
        for m in cand_list:
            cid = m.pk
            c = content_map.get(cid, 0.5)
            cf = collab_map.get(cid, 0.5)
            p = pop_map.get(cid, 0.5)
            mi = mistral_map.get(cid, 0.55)
            raw = (
                weights["content_w"] * c
                + weights["collab_w"] * cf
                + weights["popularity_w"] * p
                + weights["mistral_w"] * mi
            )
            raw *= freshness_multiplier(m)
            scored.append(
                ScoredMovie(
                    movie=m,
                    final_score=raw,
                    content_score=c,
                    collab_score=cf,
                    popularity_score=p,
                    mistral_score=mi,
                )
            )

        scored.sort(key=lambda x: -x.final_score)

        if apply_filters:
            ranked = [(s.movie, s.final_score) for s in scored]
            filtered = apply_diversity_filter(ranked, top_n=min(10, len(ranked)))
            order_ids = {m.pk: i for i, (m, _) in enumerate(filtered)}
            head_ids = set(order_ids.keys())

            rest = [s for s in scored if s.movie.pk not in head_ids]
            head_scored = [s for s in scored if s.movie.pk in head_ids]
            head_scored.sort(key=lambda s: order_ids.get(s.movie.pk, 999))

            merged = head_scored + sorted(rest, key=lambda x: -x.final_score)
            return merged[:limit], weights

        return scored[:limit], weights

    def recommendations_for_feed(
        self,
        user,
    ) -> dict[str, Any]:
        base = Movie.objects.all().prefetch_related("genres")
        if self.is_cold_start(user):
            cold = (
                base.order_by("-popularity_score", "-created_at")[:40],
                "cold_start",
            )
            scored: list[ScoredMovie] = []
            for m in cold[0][:24]:
                scored.append(
                    ScoredMovie(
                        movie=m,
                        final_score=float(m.popularity_score) * freshness_multiplier(m),
                        content_score=0.4,
                        collab_score=0.4,
                        popularity_score=float(m.popularity_score),
                        mistral_score=0.5,
                    )
                )
            return {
                "mode": "cold_start",
                "for_you": scored,
                "because_liked": [],
                "users_like_you": [],
                "hidden_gems": scored[:12],
                "expand": scored[:12],
            }

        rated_ids = Rating.objects.filter(user=user).values_list("movie_id", flat=True)

        for_you_q = base.exclude(pk__in=rated_ids)
        for_you, _ = self.score_candidates(user, for_you_q, limit=24)

        liked = (
            Rating.objects.filter(user=user, stars__gte=4)
            .select_related("movie")
            .order_by("-created_at")
            .first()
        )
        because = []
        if liked:
            sim = self.chroma.query_similar(liked.movie_id, None, top_k=30, exclude_ids=list(rated_ids))
            mids = [x[0] for x in sim]
            because_q = base.filter(pk__in=mids)
            because_map = {m.pk: m for m in because_q}
            ordered = [because_map[i] for i in mids if i in because_map][:24]
            because, _ = self.score_candidates(
                user,
                Movie.objects.filter(pk__in=[m.pk for m in ordered]),
                limit=len(ordered),
            )
            order_idx = {mid: i for i, mid in enumerate(mids)}
            because.sort(key=lambda s: order_idx.get(s.movie.pk, 999))

        sim_users = self._similar_users(user, 12)
        collab_q = base.exclude(pk__in=rated_ids)
        if sim_users:
            top_rated = (
                Rating.objects.filter(user_id__in=sim_users, stars__gte=4)
                .values("movie_id")
                .annotate(c=Count("id"))
                .order_by("-c")[:40]
            )
            mids_u = [x["movie_id"] for x in top_rated]
            collab_q = base.filter(pk__in=mids_u).exclude(pk__in=rated_ids)

        users_like_you, _ = self.score_candidates(user, collab_q, limit=24)

        hidden = (
            base.exclude(pk__in=rated_ids)
            .filter(popularity_score__lt=0.45)
            .order_by("-created_at")[:80]
        )
        hidden_scored, _ = self.score_candidates(user, hidden, limit=16)

        user_genres = (
            Rating.objects.filter(user=user)
            .values_list("movie__genres__id", flat=True)
        )
        from collections import Counter

        top_g = [g for g, _ in Counter([x for x in user_genres if x]).most_common(4)]
        expand_q = base.exclude(pk__in=rated_ids).exclude(genres__id__in=top_g) if top_g else base.none()
        expand_scored, _ = self.score_candidates(user, expand_q, limit=16)

        return {
            "mode": "personalized",
            "for_you": for_you,
            "because_liked": because,
            "users_like_you": users_like_you,
            "hidden_gems": hidden_scored,
            "expand": expand_scored,
        }

    def _similar_users(self, user, k: int = 12) -> list[int]:
        ratings = list(Rating.objects.values_list("user_id", "movie_id", "stars"))
        if len(ratings) < 5:
            return []
        user_index: dict[int, int] = {}
        movie_index: dict[int, int] = {}
        rows: list[int] = []
        cols: list[int] = []
        data: list[float] = []
        for uid, mid, stars in ratings:
            if uid not in user_index:
                user_index[uid] = len(user_index)
            if mid not in movie_index:
                movie_index[mid] = len(movie_index)
            rows.append(user_index[uid])
            cols.append(movie_index[mid])
            data.append(float(stars))
        if user.id not in user_index:
            return []
        mat = csr_matrix((data, (rows, cols)), shape=(len(user_index), len(movie_index)))
        u_idx = user_index[user.id]
        sims = np.asarray(cosine_similarity(mat[u_idx], mat)[0], dtype=np.float64).ravel()
        order = np.argsort(-sims)[1 : k + 1]
        rev = {v: k for k, v in user_index.items()}
        return [rev[i] for i in order if sims[i] > 0.05]

    def explain_for_movie(self, user, movie: Movie) -> tuple[str, dict[str, float]]:
        liked = (
            Rating.objects.filter(user=user, stars__gte=4)
            .select_related("movie")
            .order_by("-stars")[:8]
        )
        liked_titles = [r.movie.title for r in liked]
        user_genres = set(movie.genres.values_list("name", flat=True))
        overlap = []
        for r in liked:
            lg = set(r.movie.genres.values_list("name", flat=True))
            overlap.extend(list(user_genres & lg))
        overlap = list(dict.fromkeys(overlap))[:6]
        text = self.mistral.explain_recommendation(
            movie.title,
            movie.summary,
            liked_titles,
            overlap,
        )
        weights = self._weights_for_user(user)
        smap = {
            "content": self._content_scores(user, [movie.pk]).get(movie.pk, 0.5),
            "collab": self._collaborative_scores(user, [movie.pk]).get(movie.pk, 0.5),
            "popularity": self._popularity_map([movie]).get(movie.pk, 0.5),
            "mistral": self._mistral_scores_map(user, [movie]).get(movie.pk, 0.55),
        }
        parts = [
            weights["content_w"] * smap["content"],
            weights["collab_w"] * smap["collab"],
            weights["popularity_w"] * smap["popularity"],
            weights["mistral_w"] * smap["mistral"],
        ]
        s = sum(parts) or 1e-6
        attribution = {
            "content_pct": round(100 * parts[0] / s),
            "collab_pct": round(100 * parts[1] / s),
            "pop_pct": round(100 * parts[2] / s),
            "mistral_pct": round(100 * parts[3] / s),
        }
        return text, attribution
