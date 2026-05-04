from django.shortcuts import get_object_or_404
from rest_framework import serializers

from catalog.models import Movie
from catalog.serializers import MovieListSerializer
from engagement.models import Interaction, Rating


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


class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = ("id", "movie", "event_type", "created_at")
        read_only_fields = ("id", "created_at")
