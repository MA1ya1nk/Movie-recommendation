from django.contrib import admin

from engagement.models import (
    ABVariant,
    Favorite,
    Interaction,
    NotInterested,
    Rating,
    TasteEvolutionSnapshot,
    UserProfile,
)


@admin.register(ABVariant)
class ABVariantAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "content_w", "collab_w", "popularity_w", "mistral_w")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "ab_variant")
    raw_id_fields = ("user",)


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "movie", "created_at")
    raw_id_fields = ("user", "movie")


@admin.register(NotInterested)
class NotInterestedAdmin(admin.ModelAdmin):
    list_display = ("user", "movie", "created_at")
    raw_id_fields = ("user", "movie")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("user", "movie", "stars", "created_at")
    raw_id_fields = ("user", "movie")


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("user", "movie", "event_type", "ab_variant_key", "created_at")


@admin.register(TasteEvolutionSnapshot)
class TasteEvolutionSnapshotAdmin(admin.ModelAdmin):
    list_display = ("user", "rating_count_at_snapshot", "created_at")
