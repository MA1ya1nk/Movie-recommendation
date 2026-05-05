"""
Strict discovery picks: Chroma order + DB genre gating + controlled neighbor fallback.
"""
from __future__ import annotations

from typing import Any

from catalog.models import Genre, Movie
from catalog.serializers import MovieListSerializer
from engagement.models import NotInterested, Rating
from recommendations.services.chroma_store import ChromaMovieStore

# Keys must match `Genre.name` in the catalog (see seed_data.GENRE_NAMES).
# One hop only — e.g. Horror does not expand to Crime (too often wrong for "I want horror").
GENRE_NEIGHBORS: dict[str, frozenset[str]] = {
    "Horror": frozenset({"Thriller"}),
    "Thriller": frozenset({"Horror", "Crime", "Action"}),
    "Crime": frozenset({"Thriller", "Drama"}),
    "Romance": frozenset({"Drama", "Comedy"}),
    "Comedy": frozenset({"Romance", "Drama", "Animation"}),
    "Drama": frozenset({"Thriller", "Crime", "Romance"}),
    "Action": frozenset({"Adventure", "Thriller"}),
    "Adventure": frozenset({"Action", "Fantasy", "Animation"}),
    "Fantasy": frozenset({"Adventure", "Sci-Fi"}),
    "Sci-Fi": frozenset({"Thriller", "Fantasy", "Action"}),
    "Animation": frozenset({"Comedy", "Adventure"}),
    "Documentary": frozenset({"Drama"}),
}

# User / model strings -> canonical catalog genre name
GENRE_ALIASES: dict[str, str] = {
    "science fiction": "Sci-Fi",
    "sci fi": "Sci-Fi",
    "scifi": "Sci-Fi",
    "sci-fi": "Sci-Fi",
    "sf": "Sci-Fi",
    "terror": "Horror",
    "scary": "Horror",
    "scare": "Horror",
}


def _resolve_strict_genre_ids(suggested: list[Any], name_to_pk: dict[str, int]) -> set[int]:
    out: set[int] = set()
    if not isinstance(suggested, list):
        return out
    for raw in suggested[:12]:
        if not isinstance(raw, str):
            continue
        s = raw.strip()
        if not s:
            continue
        low = s.lower()
        if low in GENRE_ALIASES:
            s = GENRE_ALIASES[low]
            low = s.lower()
        pk = name_to_pk.get(low)
        if pk is not None:
            out.add(pk)
            continue
        # e.g. "Intense Horror" -> try last token
        parts = low.replace("-", " ").split()
        for token in (low, parts[-1] if parts else low):
            if token in GENRE_ALIASES:
                canon = GENRE_ALIASES[token]
                p2 = name_to_pk.get(canon.lower())
                if p2 is not None:
                    out.add(p2)
                    break
            p2 = name_to_pk.get(token)
            if p2 is not None:
                out.add(p2)
                break
    return out


def _resolve_avoid_genre_ids(avoid: list[Any], name_to_pk: dict[str, int]) -> set[int]:
    out: set[int] = set()
    if not isinstance(avoid, list):
        return out
    for raw in avoid[:16]:
        if not isinstance(raw, str):
            continue
        low = raw.strip().lower()
        if not low:
            continue
        pk = name_to_pk.get(low)
        if pk is not None:
            out.add(pk)
    return out


def _expanded_genre_ids(
    strict_pks: set[int],
    id_to_name: dict[int, str],
    name_to_pk: dict[str, int],
) -> set[int]:
    out = set(strict_pks)
    for gid in strict_pks:
        name = id_to_name.get(gid)
        if not name:
            continue
        for neigh in GENRE_NEIGHBORS.get(name, frozenset()):
            pk = name_to_pk.get(neigh.lower())
            if pk is not None:
                out.add(pk)
    return out


def _movie_genre_pks(movie: Movie) -> set[int]:
    return {g.pk for g in movie.genres.all()}


def suggestions_for_discovery_user(user, payload: dict) -> list[dict]:
    """
    Rank Chroma hits: strict user genres first, one-hop neighbors second,
    then high-similarity rows that still touch the expanded genre set; avoid list
    removes whole genres when those labels exist in the DB.
    """
    summary = (payload.get("summary") or "").strip()
    parts: list[str] = []
    if summary:
        parts.append(summary)
    sg = payload.get("suggested_genres")
    if isinstance(sg, list) and sg:
        parts.append("Genres: " + ", ".join(str(x) for x in sg[:12]))
    av = payload.get("avoid")
    if isinstance(av, list) and av:
        parts.append("Avoid: " + ", ".join(str(x) for x in av[:12]))
    query = ". ".join(parts)
    if not query:
        return []

    genres = list(Genre.objects.all())
    name_to_pk = {g.name.lower(): g.pk for g in genres}
    id_to_name = {g.pk: g.name for g in genres}

    strict_ids = _resolve_strict_genre_ids(sg if isinstance(sg, list) else [], name_to_pk)
    avoid_ids = _resolve_avoid_genre_ids(av if isinstance(av, list) else [], name_to_pk)
    expanded_ids = (
        _expanded_genre_ids(strict_ids, id_to_name, name_to_pk) if strict_ids else set()
    )

    suppress = set(Rating.objects.filter(user=user).values_list("movie_id", flat=True)) | set(
        NotInterested.objects.filter(user=user).values_list("movie_id", flat=True)
    )

    try:
        store = ChromaMovieStore()
        similar = store.query_similar(None, query, top_k=96)
    except Exception:
        return []

    if not similar:
        return []

    mids_order = [mid for mid, _ in similar]
    qs = {
        m.pk: m
        for m in Movie.objects.filter(pk__in=mids_order).prefetch_related("genres")
    }

    sim_by_mid = {mid: sim for mid, sim in similar}

    def passes_avoid(m: Movie) -> bool:
        if not avoid_ids:
            return True
        gids = _movie_genre_pks(m)
        return not (gids & avoid_ids)

    pool: list[tuple[int, float, Movie]] = []
    for mid in mids_order:
        if mid in suppress:
            continue
        m = qs.get(mid)
        if not m or not passes_avoid(m):
            continue
        pool.append((mid, float(sim_by_mid.get(mid, 0.0)), m))

    target = 12
    chosen: list[int] = []
    seen: set[int] = set()

    def take_from(predicate, min_sim: float = 0.0) -> None:
        nonlocal chosen
        for mid, sim, m in pool:
            if len(chosen) >= target:
                return
            if mid in seen or sim < min_sim:
                continue
            gids = _movie_genre_pks(m)
            if predicate(gids, sim):
                chosen.append(mid)
                seen.add(mid)

    if strict_ids:
        take_from(lambda gids, _: bool(gids & strict_ids))
        take_from(
            lambda gids, _: bool(gids & expanded_ids) and not bool(gids & strict_ids),
        )
        # Any remaining title that still matches expanded genres (ordering = Chroma).
        take_from(lambda gids, _: bool(gids & expanded_ids))
        if len(chosen) < 4:
            take_from(lambda _, sim: sim >= 0.74, min_sim=0.74)
    else:
        # No resolvable genres — keep vector order only (still exclude avoid).
        for mid, sim, m in pool:
            if len(chosen) >= target:
                break
            if mid in seen:
                continue
            chosen.append(mid)
            seen.add(mid)

    if not chosen:
        return []

    ordered = [qs[mid] for mid in chosen if mid in qs]
    return MovieListSerializer(ordered, many=True).data


def genre_vocabulary_hint() -> str:
    """Bias-free hint for the LLM: valid genre spellings only."""
    names = list(Genre.objects.order_by("name").values_list("name", flat=True))
    if not names:
        return "No genre taxonomy loaded."
    return "Catalog genre labels (use exact spelling for suggested_genres when applicable): " + ", ".join(names) + "."
