"""
Encode movie text with sentence-transformers and upsert vectors into ChromaDB.
"""

from django.core.management.base import BaseCommand

from catalog.models import Movie
from recommendations.services.chroma_store import ChromaMovieStore


class Command(BaseCommand):
    help = "Sync all movie embeddings into ChromaDB (all-MiniLM-L6-v2)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch",
            type=int,
            default=64,
            help="Progress print interval.",
        )

    def handle(self, *args, **options):
        store = ChromaMovieStore()
        qs = Movie.objects.all().prefetch_related("genres")
        total = qs.count()
        for i, movie in enumerate(qs.iterator(), start=1):
            store.sync_movie_embedding(movie)
            if i % options["batch"] == 0:
                self.stdout.write(f"Embedded {i}/{total}…")
        self.stdout.write(self.style.SUCCESS(f"Done. {total} movies synced to Chroma."))
