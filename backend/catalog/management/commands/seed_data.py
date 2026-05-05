"""
Seed 200+ movies, genres, A/B variants, 50+ synthetic users with 10–30 ratings each.
"""

import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import Genre, Movie
from engagement.models import ABVariant, Favorite, NotInterested, Rating

User = get_user_model()

GENRE_NAMES = [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Fantasy",
    "Horror",
    "Romance",
    "Sci-Fi",
    "Thriller",
]

FIRST_NAMES = [
    "Maya",
    "Ethan",
    "Sofia",
    "Noah",
    "Zara",
    "Leo",
    "Priya",
    "Jon",
    "Elena",
    "Marcus",
    "Yuki",
    "Amara",
    "Diego",
    "Freya",
    "Kenji",
    "Nina",
    "Omar",
    "Ines",
    "Viktor",
    "Lila",
]

LAST_NAMES = [
    "Hayes",
    "Okonkwo",
    "Petrov",
    "Silva",
    "Nguyen",
    "Patel",
    "Santos",
    "Lindqvist",
    "Carver",
    "Duarte",
    "Nakamura",
    "Volkov",
    "Rahman",
    "Costa",
    "Blake",
]

TITLE_A = [
    "Midnight",
    "Neon",
    "Silent",
    "Golden",
    "Broken",
    "Last",
    "Parallel",
    "Velvet",
    "Ocean",
    "Paper",
    "Glass",
    "Iron",
    "Blue",
    "Shadow",
    "Summer",
    "Winter",
    "Electric",
    "Wild",
    "Ancient",
    "Hidden",
]

TITLE_B = [
    "Echoes",
    "Horizon",
    "Protocol",
    "Symphony",
    "Algorithm",
    "Voyage",
    "Covenant",
    "Circuit",
    "Harbor",
    "Frontier",
    "Compass",
    "Mirage",
    "Ledger",
    "Orbit",
    "Riddle",
    "Parade",
    "Garden",
    "Spire",
    "Kingdom",
    "Legacy",
]

SUMMARY_TEMPLATES = [
    "A {adj} story about {topic} that tests loyalty when secrets unravel across {place}.",
    "When a discovery threatens {topic}, an unlikely group must outrun time in {place}.",
    "{adj} and intimate, this film traces grief, humor, and courage through {place}.",
    "An ensemble drama where {topic} collides with ambition on the eve of a great storm.",
]


class Command(BaseCommand):
    help = "Seed genres, A/B variants, 220 movies, 50 users with ratings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete catalog/ratings related data before seeding (dev only).",
        )

    def handle(self, *args, **options):
        rng = random.Random(42)
        if options["reset"]:
            self.stdout.write(self.style.WARNING("Resetting movie/rating data…"))
            Rating.objects.all().delete()
            Favorite.objects.all().delete()
            NotInterested.objects.all().delete()
            Movie.objects.all().delete()
            Genre.objects.all().delete()
            User.objects.filter(email__endswith="@seed.local").delete()

        with transaction.atomic():
            self._seed_ab_variants()
            genres = self._seed_genres()
            movies = self._seed_movies(genres, rng)
            self._seed_users_and_ratings(movies, rng)

        self.stdout.write(self.style.SUCCESS("Seed complete."))

    def _seed_ab_variants(self):
        ABVariant.objects.update_or_create(
            key="content_heavy",
            defaults={
                "label": "Content-Heavy",
                "content_w": 0.50,
                "collab_w": 0.20,
                "popularity_w": 0.10,
                "mistral_w": 0.20,
            },
        )
        ABVariant.objects.update_or_create(
            key="collab_heavy",
            defaults={
                "label": "Collab-Heavy",
                "content_w": 0.20,
                "collab_w": 0.50,
                "popularity_w": 0.10,
                "mistral_w": 0.20,
            },
        )
        self.stdout.write("A/B variants ready.")

    def _seed_genres(self):
        genres = []
        for name in GENRE_NAMES:
            g, _ = Genre.objects.get_or_create(name=name)
            genres.append(g)
        return genres

    def _seed_movies(self, genres, rng: random.Random):
        """Seed 220 catalog slots (tmdb_id 10000–10219). Titles are unique per slot; re-runs skip existing rows."""
        today = timezone.now().date()
        movies: list[Movie] = []
        for i in range(220):
            catalog_id = 10_000 + i
            existing = Movie.objects.filter(tmdb_id=catalog_id).first()
            if existing is not None:
                movies.append(existing)
                continue

            base = f"{rng.choice(TITLE_A)} {rng.choice(TITLE_B)}"
            title = f"{base} · #{catalog_id}"
            director = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
            cast = [
                f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
            ]
            tpl = rng.choice(SUMMARY_TEMPLATES)
            summary = tpl.format(
                adj=rng.choice(["tender", "ferocious", "lyrical", "razor-sharp"]),
                topic=rng.choice(["memory", "justice", "family", "identity", "truth"]),
                place=rng.choice(["a coastal city", "the desert", "a snowbound town", "neo-Tokyo"]),
            )
            pop = round(rng.uniform(0.15, 0.98), 3)
            rd = today - timedelta(days=rng.randint(400, 8000))
            fresh_days = rng.random() < 0.08
            created = timezone.now() - timedelta(days=rng.randint(1, 30) if fresh_days else rng.randint(8, 120))

            m = Movie.objects.create(
                tmdb_id=catalog_id,
                title=title,
                director=director,
                cast=cast,
                summary=summary,
                backdrop_path=f"https://picsum.photos/seed/b{i}/1280/720",
                poster_path=f"https://picsum.photos/seed/p{i}/400/600",
                release_date=rd,
                popularity_score=pop,
            )
            Movie.objects.filter(pk=m.pk).update(created_at=created)
            pick = rng.sample(genres, k=rng.randint(1, 3))
            m.genres.set(pick)
            movies.append(m)

        self.stdout.write(f"Catalog movies: {len(movies)} (created missing slots or reused existing by tmdb_id).")
        return movies

    def _seed_users_and_ratings(self, movies: list[Movie], rng: random.Random):
        for u in range(50):
            email = f"viewer{u}@seed.local"
            if User.objects.filter(email=email).exists():
                continue
            user = User.objects.create_user(
                username=f"viewer{u}",
                email=email,
                password="seedpass123",
            )
            k = rng.randint(10, 30)
            picks = rng.sample(movies, k=min(k, len(movies)))
            for mv in picks:
                stars = int(
                    rng.choices([1, 2, 3, 4, 5], weights=[5, 10, 15, 35, 35], k=1)[0]
                )
                Rating.objects.create(user=user, movie=mv, stars=stars)
        self.stdout.write("Created 50 synthetic users with ratings.")
