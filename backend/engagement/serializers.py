from django.shortcuts import get_object_or_404
from rest_framework import serializers

from catalog.models import Movie
from catalog.serializers import MovieListSerializer
from engagement.models import Favorite, Interaction, NotInterested, Rating


class RatingSerializer(serializers.ModelSerializer):
    movie_slug = serializers.SlugField(write_only=True)
    movie = MovieListSerializer(read_only=True)

    class Meta:
        model = Rating
        fields = ("id", "movie_slug", "movie", "stars", "created_at")
        read_only_fields = ("id", "movie", "created_at")

    def validate_stars(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Stars must be 1-5.")
        return value

    def create(self, validated_data):
        slug = validated_data.pop("movie_slug")
        movie = get_object_or_404(Movie, slug=slug)
        user = self.context["request"].user
        rating, _ = Rating.objects.update_or_create(
            user=user,
            movie=movie,
            defaults={"stars": validated_data["stars"]},
        )
        return rating


class FavoriteSerializer(serializers.ModelSerializer):
    movie_slug = serializers.SlugField(write_only=True)
    movie = MovieListSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ("id", "movie_slug", "movie", "created_at")
        read_only_fields = ("id", "movie", "created_at")

    def create(self, validated_data):
        slug = validated_data.pop("movie_slug")
        movie = get_object_or_404(Movie, slug=slug)
        user = self.context["request"].user
        NotInterested.objects.filter(user=user, movie=movie).delete()
        fav, _ = Favorite.objects.get_or_create(user=user, movie=movie)
        return Favorite.objects.select_related("movie").get(pk=fav.pk)


class NotInterestedSerializer(serializers.ModelSerializer):
    movie_slug = serializers.SlugField(write_only=True)
    movie = MovieListSerializer(read_only=True)

    class Meta:
        model = NotInterested
        fields = ("id", "movie_slug", "movie", "created_at")
        read_only_fields = ("id", "movie", "created_at")

    def create(self, validated_data):
        slug = validated_data.pop("movie_slug")
        movie = get_object_or_404(Movie, slug=slug)
        user = self.context["request"].user
        Favorite.objects.filter(user=user, movie=movie).delete()
        row, _ = NotInterested.objects.get_or_create(user=user, movie=movie)
        return NotInterested.objects.select_related("movie").get(pk=row.pk)


class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = ("id", "movie", "event_type", "created_at")
        read_only_fields = ("id", "created_at")
