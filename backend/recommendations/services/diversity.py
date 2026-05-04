from __future__ import annotations

from collections.abc import Iterable

from catalog.models import Movie


def distinct_genre_count(movies: Iterable[Movie]) -> int:
    ids: set[int] = set()
    for m in movies:
        ids.update(m.genres.values_list("id", flat=True))
    return len(ids)


def _dedupe_ranked_preserve_order(ranked: list[tuple[Movie, float]]) -> list[tuple[Movie, float]]:
    seen: set[int] = set()
    out: list[tuple[Movie, float]] = []
    for movie, score in ranked:
        if movie.pk in seen:
            continue
        seen.add(movie.pk)
        out.append((movie, score))
    return out


def apply_diversity_filter(
    ranked: list[tuple[Movie, float]],
    top_n: int = 10,
    min_genres: int = 3,
    pool_multiplier: int = 5,
) -> list[tuple[Movie, float]]:
    """Reorder candidates so top_n tends to cover at least `min_genres` genres."""
    ranked = _dedupe_ranked_preserve_order(ranked)
    if len(ranked) <= top_n:
        return ranked
    pool = list(ranked[: max(top_n * pool_multiplier, top_n + 25)])
    selected: list[tuple[Movie, float]] = []
    used_ids: set[int] = set()

    def existing_genres(sel: list[tuple[Movie, float]]) -> set[int]:
        g: set[int] = set()
        for m, _ in sel:
            g.update(m.genres.values_list("id", flat=True))
        return g

    while len(selected) < top_n and pool:
        eg = existing_genres(selected)
        best_i: int | None = None
        best_tuple: tuple | None = None

        for i, (movie, score) in enumerate(pool):
            if movie.pk in used_ids:
                continue
            gs = set(movie.genres.values_list("id", flat=True))
            new_only = len(gs - eg)
            need_more_genres = len(eg) < min_genres and len(selected) >= 4

            if need_more_genres:
                candidate_key = (new_only, score)
            else:
                candidate_key = (score,)

            if best_tuple is None or candidate_key > best_tuple:
                best_tuple = candidate_key
                best_i = i

        if best_i is None:
            break
        movie, score = pool.pop(best_i)
        selected.append((movie, score))
        used_ids.add(movie.pk)

    if len(selected) < top_n:
        for movie, score in ranked:
            if movie.pk in used_ids:
                continue
            selected.append((movie, score))
            used_ids.add(movie.pk)
            if len(selected) >= top_n:
                break

    return selected[:top_n]


def freshness_multiplier(movie: Movie, now=None) -> float:
    from datetime import timedelta

    from django.utils import timezone

    now = now or timezone.now()
    if not movie.created_at:
        return 1.0
    age = now - movie.created_at
    if age < timedelta(days=7):
        return 1.12
    return 1.0
