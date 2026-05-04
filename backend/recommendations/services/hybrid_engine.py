from __future__ import annotations

import logging
from dataclasses import dataclass
from itertools import chain
from typing import Any, Sequence

import numpy as np
from django.contrib.auth import get_user_model
from django.db.models import Count, QuerySet
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

from catalog.models import Movie
from engagement.models import ABVariant, Favorite, NotInterested, Rating, UserProfile
from recommendations.services.chroma_store import ChromaMovieStore
from recommendations.services.diversity import apply_diversity_filter, freshness_multiplier
from recommendations.services.mistral_client import MistralService

logger = logging.getLogger(__name__)
User = get_user_model()


def _dedupe_movies_preserve_order(movies: list[Movie]) -> list[Movie]:
    """ORM joins on M2M can repeat the same Movie row; keep first occurrence only."""
    seen: set[int] = set()
    out: list[Movie] = []
    for m in movies:
        if m.pk in seen:
            continue
        seen.add(m.pk)
        out.append(m)
    return out


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

    def _suppress_movie_ids(self, user) -> list[int]:
        """Rated or explicitly dismissed — never surface in feed-style rows."""
        rated = set(Rating.objects.filter(user=user).values_list("movie_id", flat=True))
        dismissed = set(NotInterested.objects.filter(user=user).values_list("movie_id", flat=True))
        return list(rated | dismissed)

    def _positive_seed_movies(self, user, max_seeds: int = 5) -> list[Movie]:
        """4★+ ratings first (recent), then explicit favorites; deduped."""
        seeds: list[Movie] = []
        seen: set[int] = set()
        for r in (
            Rating.objects.filter(user=user, stars__gte=4)
            .select_related("movie")
            .order_by("-created_at")
        ):
            if r.movie_id not in seen:
                seen.add(r.movie_id)
                seeds.append(r.movie)
            if len(seeds) >= max_seeds:
                return seeds
        for fav in Favorite.objects.filter(user=user).select_related("movie").order_by("-created_at"):
            if fav.movie_id not in seen:
                seen.add(fav.movie_id)
                seeds.append(fav.movie)
            if len(seeds) >= max_seeds:
                break
        return seeds[:max_seeds]

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

    def _content_similar_ranked(self, user) -> list[tuple[int, float]]:
        """One aggregate Chroma signal from high-star + favorite seeds (or NL prefs). Reuse across feed rows."""
        seeds = self._positive_seed_movies(user, max_seeds=5)
        if not seeds:
            prefs = getattr(getattr(user, "profile", None), "nl_preferences", {}) or {}
            seed_text = " ".join(
                [
                    str(prefs.get("mood", "")),
                    " ".join(prefs.get("themes", []) or []),
                ]
            ).strip()
            if not seed_text:
                return []
            return self.chroma.query_similar(None, seed_text, top_k=80)
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
        merged = [
            (mid, float(np.mean(vals))) for mid, vals in agg_scores.items()
        ]
        merged.sort(key=lambda x: -x[1])
        return merged

    def _content_scores(
        self,
        user,
        candidate_ids: Sequence[int],
        similar_ranked: list[tuple[int, float]] | None = None,
    ) -> dict[int, float]:
        if similar_ranked is None:
            similar_ranked = self._content_similar_ranked(user)
        if not similar_ranked:
            return {mid: 0.5 for mid in candidate_ids}

        score_map = {mid: 0.45 for mid in candidate_ids}
        want = set(candidate_ids)
        for mid, sc in similar_ranked:
            if mid in want:
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
        lines = [f"{r.movie.title} ({r.stars})" for r in liked]
        fav_titles = list(
            Favorite.objects.filter(user=user)
            .select_related("movie")
            .order_by("-created_at")[:8]
            .values_list("movie__title", flat=True)
        )
        if fav_titles:
            lines.append("Favorites: " + ", ".join(fav_titles))
        ctx = (
            f"Mood: {prefs.get('mood','')}. Themes: {prefs.get('themes','')}.\n"
            f"Taste signals: {', '.join(lines)}"
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
        *,
        content_similar_ranked: list[tuple[int, float]] | None = None,
        use_mistral: bool = True,
    ) -> tuple[list[ScoredMovie], dict[str, float]]:
        weights = self._weights_for_user(user)
        cand_list = _dedupe_movies_preserve_order(list(candidates[: max(limit * 4, 80)]))
        if not cand_list:
            return [], weights

        ids = [m.pk for m in cand_list]
        pop_map = self._popularity_map(cand_list)
        collab_map = self._collaborative_scores(user, ids)
        content_map = self._content_scores(user, ids, content_similar_ranked)
        mistral_map = (
            self._mistral_scores_map(user, cand_list)
            if use_mistral
            else {m.pk: 0.55 for m in cand_list}
        )

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

    def _because_you_liked_for_feed(
        self,
        user,
        base: QuerySet[Movie],
        fy_ids: set[int],
        *,
        content_similar_ranked: list[tuple[int, float]] | None = None,
        use_mistral: bool = True,
    ) -> list[ScoredMovie]:
        """Chroma neighbors from latest strong signal (4★+ or explicit favorite); excludes suppressed ids."""
        suppress_ids = self._suppress_movie_ids(user)
        liked = (
            Rating.objects.filter(user=user, stars__gte=4)
            .select_related("movie")
            .order_by("-created_at")
            .first()
        )
        anchor_mid: int | None = liked.movie_id if liked else None
        if anchor_mid is None:
            fav = (
                Favorite.objects.filter(user=user)
                .select_related("movie")
                .order_by("-created_at")
                .first()
            )
            anchor_mid = fav.movie_id if fav else None
        if anchor_mid is None:
            return []
        sim = self.chroma.query_similar(anchor_mid, None, top_k=30, exclude_ids=suppress_ids)
        mids = list(dict.fromkeys(x[0] for x in sim))
        if not mids:
            return []
        because_q = base.filter(pk__in=mids).distinct()
        because_map = {m.pk: m for m in because_q}
        ordered = [because_map[i] for i in mids if i in because_map][:24]
        if not ordered:
            return []
        because, _ = self.score_candidates(
            user,
            Movie.objects.filter(pk__in=[m.pk for m in ordered]).prefetch_related("genres"),
            limit=len(ordered),
            content_similar_ranked=content_similar_ranked,
            use_mistral=use_mistral,
        )
        order_idx = {mid: i for i, mid in enumerate(mids)}
        because.sort(key=lambda s: order_idx.get(s.movie.pk, 999))
        return [s for s in because if s.movie.pk not in fy_ids]

    def recommendations_for_feed(
        self,
        user,
    ) -> dict[str, Any]:
        base = Movie.objects.all().prefetch_related("genres")
        rc = self.rating_count(user)
        if self.is_cold_start(user):
            suppress = set(self._suppress_movie_ids(user))
            raw_pool = _dedupe_movies_preserve_order(
                list(base.order_by("-popularity_score", "-created_at")[:120])
            )
            pool = [m for m in raw_pool if m.pk not in suppress][:48]
            if not pool:
                return {
                    "mode": "cold_start",
                    "rating_count": rc,
                    "for_you": [],
                    "because_liked": [],
                    "users_like_you": [],
                    "hidden_gems": [],
                    "expand": [],
                }

            def cold_scored(ms: list[Movie]) -> list[ScoredMovie]:
                return [
                    ScoredMovie(
                        movie=m,
                        final_score=float(m.popularity_score or 0.0) * freshness_multiplier(m),
                        content_score=0.4,
                        collab_score=0.4,
                        popularity_score=float(m.popularity_score or 0.0),
                        mistral_score=0.5,
                    )
                    for m in ms
                ]

            for_you_m = pool[:24]
            fy_ids = {m.pk for m in for_you_m}
            rest_after_fy = [m for m in pool if m.pk not in fy_ids]
            hidden_m = rest_after_fy[:12]
            hid_ids = fy_ids | {m.pk for m in hidden_m}
            expand_m = [m for m in pool if m.pk not in hid_ids][:12]
            if len(expand_m) < 6 and len(pool) > 24:
                expand_m = [m for m in pool[24:36] if m.pk not in hid_ids][:12]

            sim_rank = self._content_similar_ranked(user)
            because_liked = self._because_you_liked_for_feed(
                user,
                base,
                fy_ids,
                content_similar_ranked=sim_rank,
                use_mistral=False,
            )
            return {
                "mode": "cold_start",
                "rating_count": rc,
                "for_you": cold_scored(for_you_m),
                "because_liked": because_liked,
                "users_like_you": [],
                "hidden_gems": cold_scored(hidden_m),
                "expand": cold_scored(expand_m),
            }

        suppress_ids = self._suppress_movie_ids(user)

        sim_rank = self._content_similar_ranked(user)
        for_you_q = base.exclude(pk__in=suppress_ids).distinct()
        for_you, _ = self.score_candidates(
            user,
            for_you_q,
            limit=24,
            content_similar_ranked=sim_rank,
            use_mistral=False,
        )

        fy_ids_pre = {s.movie.pk for s in for_you}
        because = self._because_you_liked_for_feed(
            user,
            base,
            fy_ids_pre,
            content_similar_ranked=sim_rank,
            use_mistral=False,
        )

        sim_users = self._similar_users(user, 12)
        collab_q = base.exclude(pk__in=suppress_ids).distinct()
        if sim_users:
            top_rated = (
                Rating.objects.filter(user_id__in=sim_users, stars__gte=4)
                .values("movie_id")
                .annotate(c=Count("id"))
                .order_by("-c")[:40]
            )
            mids_u = [x["movie_id"] for x in top_rated]
            collab_q = base.filter(pk__in=mids_u).exclude(pk__in=suppress_ids).distinct()

        users_like_you, _ = self.score_candidates(
            user,
            collab_q,
            limit=24,
            content_similar_ranked=sim_rank,
            use_mistral=False,
        )

        hidden = (
            base.exclude(pk__in=suppress_ids)
            .filter(popularity_score__lt=0.45)
            .order_by("-created_at")[:80]
        )
        hidden_scored, _ = self.score_candidates(
            user,
            hidden,
            limit=16,
            content_similar_ranked=sim_rank,
            use_mistral=False,
        )

        user_genres = chain(
            Rating.objects.filter(user=user).values_list("movie__genres__id", flat=True),
            Favorite.objects.filter(user=user).values_list("movie__genres__id", flat=True),
        )
        from collections import Counter

        top_g = [g for g, _ in Counter([x for x in user_genres if x]).most_common(4)]
        expand_q = (
            base.exclude(pk__in=suppress_ids).exclude(genres__id__in=top_g).distinct()
            if top_g
            else base.none()
        )
        expand_scored, _ = self.score_candidates(
            user,
            expand_q,
            limit=16,
            content_similar_ranked=sim_rank,
            use_mistral=False,
        )

        fy_ids = {s.movie.pk for s in for_you}
        because_d = because
        uly_ids = fy_ids | {s.movie.pk for s in because_d}
        users_d = [s for s in users_like_you if s.movie.pk not in uly_ids]
        prev_ids = uly_ids | {s.movie.pk for s in users_d}
        hidden_d = [s for s in hidden_scored if s.movie.pk not in prev_ids]
        prev_ids |= {s.movie.pk for s in hidden_d}
        expand_d = [s for s in expand_scored if s.movie.pk not in prev_ids]

        return {
            "mode": "personalized",
            "rating_count": rc,
            "for_you": for_you,
            "because_liked": because_d,
            "users_like_you": users_d,
            "hidden_gems": hidden_d,
            "expand": expand_d,
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
        for t in (
            Favorite.objects.filter(user=user)
            .select_related("movie")
            .order_by("-created_at")[:6]
            .values_list("movie__title", flat=True)
        ):
            if t not in liked_titles:
                liked_titles.append(t)
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
