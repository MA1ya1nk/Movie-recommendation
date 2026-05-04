from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from engagement.models import ABVariant, Favorite, NotInterested, Rating, TasteEvolutionSnapshot, UserProfile
from recommendations.services.mistral_client import MistralService

User = get_user_model()


def _feed_cache_key(user_id: int) -> str:
    return f"feed:v3:user:{user_id}"


def _invalidate_feed_cache_for_user(user_id: int) -> None:
    cache.delete(_feed_cache_key(user_id))


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if not created:
        return
    variant = ABVariant.objects.order_by("?").first()
    UserProfile.objects.get_or_create(
        user=instance,
        defaults={"ab_variant": variant},
    )


@receiver(post_save, sender=Rating)
def taste_evolution_snapshot(sender, instance, **kwargs):
    user = instance.user
    _invalidate_feed_cache_for_user(user.id)
    count = Rating.objects.filter(user=user).count()
    if count % 5 != 0:
        return
    if TasteEvolutionSnapshot.objects.filter(
        user=user, rating_count_at_snapshot=count
    ).exists():
        return
    ratings = Rating.objects.filter(user=user).select_related("movie").order_by("-created_at")[:40]
    lines = [f"{r.movie.title}: {r.stars} stars - {r.movie.summary[:120]}" for r in ratings]
    mistral = MistralService()
    summary = mistral.taste_evolution_summary(lines)
    genre_scores = {}
    for r in ratings:
        for g in r.movie.genres.all():
            genre_scores[g.name] = genre_scores.get(g.name, 0.0) + float(r.stars)
    TasteEvolutionSnapshot.objects.create(
        user=user,
        summary=summary,
        genre_scores=genre_scores,
        rating_count_at_snapshot=count,
    )


@receiver(post_delete, sender=Rating)
def invalidate_feed_on_rating_delete(sender, instance, **kwargs):
    _invalidate_feed_cache_for_user(instance.user_id)


@receiver(post_save, sender=Favorite)
def invalidate_feed_on_favorite_save(sender, instance, **kwargs):
    _invalidate_feed_cache_for_user(instance.user_id)


@receiver(post_delete, sender=Favorite)
def invalidate_feed_on_favorite_delete(sender, instance, **kwargs):
    _invalidate_feed_cache_for_user(instance.user_id)


@receiver(post_save, sender=NotInterested)
def invalidate_feed_on_not_interested_save(sender, instance, **kwargs):
    _invalidate_feed_cache_for_user(instance.user_id)


@receiver(post_delete, sender=NotInterested)
def invalidate_feed_on_not_interested_delete(sender, instance, **kwargs):
    _invalidate_feed_cache_for_user(instance.user_id)
