from rest_framework import serializers

from catalog.models import Genre, Movie


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ("id", "name", "slug")


class MovieListSerializer(serializers.ModelSerializer):
    genres = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field="name",
    )

    class Meta:
        model = Movie
        fields = (
            "id",
            "title",
            "slug",
            "director",
            "summary",
            "backdrop_path",
            "poster_path",
            "release_date",
            "popularity_score",
            "genres",
            "created_at",
        )


class MovieDetailSerializer(MovieListSerializer):
    cast = serializers.JSONField()

    class Meta(MovieListSerializer.Meta):
        fields = MovieListSerializer.Meta.fields + ("cast", "tmdb_id")
