from django.contrib import admin

from catalog.models import Genre, Movie


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ("title", "director", "release_date", "popularity_score")
    search_fields = ("title", "director", "summary")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("genres",)
