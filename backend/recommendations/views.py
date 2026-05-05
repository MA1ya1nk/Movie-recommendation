from django.core.cache import cache
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Movie
from catalog.serializers import MovieDetailSerializer
from engagement.models import Interaction, TasteEvolutionSnapshot
from recommendations.serializers import (
    DiscoveryChatSerializer,
    NLPreferenceSerializer,
    ScoredMovieSerializer,
)
from recommendations.services.discovery_suggestions import (
    genre_vocabulary_hint,
    suggestions_for_discovery_user,
)
from recommendations.services.hybrid_engine import HybridRecommendationEngine
from recommendations.services.mistral_client import MistralService


def _feed_cache_key(user_id: int) -> str:
    return f"feed:v3:user:{user_id}"


class FeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = _feed_cache_key(request.user.id)
        cached = cache.get(cache_key)
        if isinstance(cached, dict):
            return Response(cached)

        engine = HybridRecommendationEngine()
        data = engine.recommendations_for_feed(request.user)

        def pack(rows):
            return [ScoredMovieSerializer.from_scored(x) for x in rows]

        payload = {
            "mode": data["mode"],
            "cold_start": data["mode"] == "cold_start",
            "rating_count": data["rating_count"],
            "for_you": pack(data["for_you"]),
            "because_you_liked": pack(data["because_liked"]),
            "users_like_you": pack(data["users_like_you"]),
            "hidden_gems": pack(data["hidden_gems"]),
            "expand_your_horizons": pack(data["expand"]),
        }
        cache.set(cache_key, payload, timeout=60)
        return Response(payload)


class MovieExplainView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        movie = get_object_or_404(Movie.objects.prefetch_related("genres"), slug=slug)
        engine = HybridRecommendationEngine()
        explanation, attribution = engine.explain_for_movie(request.user, movie)
        detail = MovieDetailSerializer(movie).data
        return Response(
            {
                "movie": detail,
                "why_recommended": explanation,
                "algorithm_attribution": attribution,
            }
        )


class NLPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = NLPreferenceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mistral = MistralService()
        extracted = mistral.extract_nl_preferences(ser.validated_data["text"])
        profile = request.user.profile
        profile.nl_preferences = extracted
        profile.save(update_fields=["nl_preferences"])
        return Response({"preferences": extracted})


class ProfileSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from engagement.models import Favorite, Rating

        user = request.user
        ratings = Rating.objects.filter(user=user).select_related("movie")
        genre_counts = {}
        for r in ratings:
            for g in r.movie.genres.all():
                genre_counts[g.name] = genre_counts.get(g.name, 0) + 1
        for fav in Favorite.objects.filter(user=user).select_related("movie"):
            for g in fav.movie.genres.all():
                genre_counts[g.name] = genre_counts.get(g.name, 0) + 1

        snapshots = TasteEvolutionSnapshot.objects.filter(user=user).order_by("created_at")[:24]
        evolution = [
            {"at": s.created_at.isoformat(), "summary": s.summary, "genre_scores": s.genre_scores}
            for s in snapshots
        ]

        return Response(
            {
                "email": user.email,
                "rating_count": ratings.count(),
                "genre_map": genre_counts,
                "taste_evolution": evolution,
                "nl_preferences": getattr(user.profile, "nl_preferences", {}) or {},
            }
        )


class DiscoveryChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = DiscoveryChatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mistral = MistralService()
        hint = genre_vocabulary_hint()
        result = mistral.discovery_chat_turn(ser.validated_data["messages"], hint)
        if isinstance(result, dict) and result.get("done") and result.get("summary"):
            out = dict(result)
            out["suggestions"] = suggestions_for_discovery_user(request.user, out)
            return Response(out)
        return Response(result)


class ABMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Simple CTR and engagement proxy for A/B variants (admin-style)."""
        qs = Interaction.objects.all()
        variants = qs.values("ab_variant_key").annotate(
            impressions=Count("id", filter=Q(event_type=Interaction.IMPRESSION)),
            clicks=Count("id", filter=Q(event_type=Interaction.CLICK)),
        )
        rows = []
        for row in variants:
            key = row["ab_variant_key"] or "unknown"
            imp = row["impressions"] or 0
            clk = row["clicks"] or 0
            ctr = (clk / imp * 100.0) if imp else 0.0
            rows.append(
                {
                    "variant": key,
                    "impressions": imp,
                    "clicks": clk,
                    "ctr_percent": round(ctr, 2),
                    "engagement_score": round(clk * 1.5 + imp * 0.05, 2),
                }
            )
        return Response({"variants": rows})


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
