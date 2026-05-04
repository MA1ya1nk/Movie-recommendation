from django.db import models
from django.utils.text import slugify


class Genre(models.Model):
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=72, unique=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:72]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Movie(models.Model):
    tmdb_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    title = models.CharField(max_length=256)
    slug = models.SlugField(max_length=280, unique=True, db_index=True)
    director = models.CharField(max_length=128)
    cast = models.JSONField(default=list)
    summary = models.TextField()
    backdrop_path = models.CharField(max_length=512, blank=True)
    poster_path = models.CharField(max_length=512, blank=True)
    release_date = models.DateField(null=True, blank=True)
    popularity_score = models.FloatField(default=0.5)
    genres = models.ManyToManyField(Genre, related_name="movies", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-popularity_score", "title"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        base = slugify(self.title)[:200] or "movie"
        desired = f"{base}-{self.pk}"[:280]
        if self.slug != desired:
            self.slug = desired
            super().save(update_fields=["slug"])

    def __str__(self) -> str:
        return self.title
