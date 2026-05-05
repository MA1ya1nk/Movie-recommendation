from rest_framework import serializers

from catalog.serializers import MovieListSerializer
from recommendations.services.hybrid_engine import ScoredMovie


class ScoredMovieSerializer(serializers.Serializer):
    movie = MovieListSerializer()
    final_score = serializers.FloatField()
    content_score = serializers.FloatField()
    collab_score = serializers.FloatField()
    popularity_score = serializers.FloatField()
    mistral_score = serializers.FloatField()

    @classmethod
    def from_scored(cls, sm: ScoredMovie):
        return {
            "movie": MovieListSerializer(sm.movie).data,
            "final_score": sm.final_score,
            "content_score": sm.content_score,
            "collab_score": sm.collab_score,
            "popularity_score": sm.popularity_score,
            "mistral_score": sm.mistral_score,
        }


class NLPreferenceSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=4000)


class DiscoveryChatSerializer(serializers.Serializer):
    messages = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        allow_empty=False,
    )
