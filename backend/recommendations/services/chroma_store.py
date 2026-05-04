from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Sequence

import chromadb
import numpy as np
from chromadb.api.models.Collection import Collection
from django.conf import settings

MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _embedding_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


class ChromaMovieStore:
    """Persists movie embeddings in ChromaDB; similarity via cosine (default)."""

    def __init__(self, persist_directory: str | Path | None = None) -> None:
        base = persist_directory or getattr(
            settings,
            "CHROMA_PATH",
            Path(settings.BASE_DIR) / "chroma_data",
        )
        os.makedirs(base, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(base))
        self._collection: Collection = self._client.get_or_create_collection(
            name="movies",
            metadata={"hnsw:space": "cosine"},
        )

    def movie_text(self, title: str, summary: str, genre_names: Sequence[str]) -> str:
        g = ", ".join(genre_names)
        return f"{title}. Genres: {g}. {summary}"

    def upsert_movie(self, movie_id: int, document: str) -> None:
        self._collection.upsert(
            ids=[str(movie_id)],
            documents=[document],
            metadatas=[{"movie_id": movie_id}],
        )

    def delete_movie(self, movie_id: int) -> None:
        self._collection.delete(ids=[str(movie_id)])

    def embed_texts(self, texts: Iterable[str]):
        model = _embedding_model()
        return model.encode(list(texts), normalize_embeddings=True)

    def sync_movie_embedding(self, movie) -> None:
        genres = list(movie.genres.values_list("name", flat=True))
        doc = self.movie_text(movie.title, movie.summary, genres)
        self.upsert_movie(movie.pk, doc)

    def query_similar(
        self,
        movie_id: int | None,
        query_text: str | None,
        top_k: int = 25,
        exclude_ids: Sequence[int] | None = None,
    ) -> list[tuple[int, float]]:
        exclude = set(exclude_ids or [])
        try:
            n_docs = self._collection.count()
        except Exception:
            n_docs = top_k * 4
        n_results = min(max(top_k + len(exclude) + 5, top_k), max(n_docs, top_k))

        if query_text:
            emb = self.embed_texts([query_text])[0].tolist()
            res = self._collection.query(
                query_embeddings=[emb],
                n_results=n_results,
                include=["distances", "metadatas"],
            )
        elif movie_id is not None:
            got = self._collection.get(ids=[str(movie_id)], include=["embeddings"])
            raw_emb = got.get("embeddings")
            if raw_emb is None:
                return []
            arr = np.asarray(raw_emb, dtype=np.float64)
            if arr.size == 0:
                return []
            # Chroma may return ndarray; `if not arr` is ambiguous for multi-element arrays.
            if arr.ndim == 1:
                emb = arr.tolist()
            else:
                emb = np.asarray(arr[0]).ravel().tolist()
            res = self._collection.query(
                query_embeddings=[emb],
                n_results=n_results,
                include=["distances", "metadatas"],
            )
        else:
            return []
        out: list[tuple[int, float]] = []
        seen_mid: set[int] = set()
        ids = res.get("ids", [[]])[0]
        dists = res.get("distances", [[]])[0]
        for sid, d in zip(ids, dists):
            meta = self._collection.get(ids=[sid], include=["metadatas"])["metadatas"]
            mid = int(meta[0].get("movie_id", sid)) if meta else int(sid)
            if mid in exclude or mid in seen_mid:
                continue
            seen_mid.add(mid)
            sim = 1.0 - float(d)
            out.append((mid, max(0.0, min(1.0, sim))))
            if len(out) >= top_k:
                break
        return out
