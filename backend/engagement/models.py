from django.conf import settings
from django.db import models


class ABVariant(models.Model):
    """A/B weights for hybrid recommender (must sum to ~1.0 for the four components)."""

    key = models.CharField(max_length=32, unique=True, db_index=True)
    label = models.CharField(max_length=128)
    content_w = models.FloatField()
    collab_w = models.FloatField()
    popularity_w = models.FloatField()
    mistral_w = models.FloatField()

    class Meta:
        ordering = ["key"]

    def __str__(self) -> str:
        return f"{self.label} ({self.key})"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    ab_variant = models.ForeignKey(
        ABVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    nl_preferences = models.JSONField(default=dict, blank=True)
    onboarding_hints = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"


class Rating(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    movie = models.ForeignKey(
        "catalog.Movie",
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    stars = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "movie"], name="uniq_user_movie_rating"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.movie_id}:{self.stars}"


class Interaction(models.Model):
    IMPRESSION = "impression"
    CLICK = "click"
    EVENT_CHOICES = [(IMPRESSION, "impression"), (CLICK, "click")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interactions",
        null=True,
        blank=True,
    )
    movie = models.ForeignKey(
        "catalog.Movie",
        on_delete=models.CASCADE,
        related_name="interactions",
    )
    event_type = models.CharField(max_length=16, choices=EVENT_CHOICES, db_index=True)
    ab_variant_key = models.CharField(max_length=32, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ab_variant_key", "event_type", "created_at"]),
        ]


class TasteEvolutionSnapshot(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="taste_snapshots",
    )
    summary = models.TextField()
    genre_scores = models.JSONField(default=dict)
    rating_count_at_snapshot = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
