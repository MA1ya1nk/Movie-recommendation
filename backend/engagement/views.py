from django.shortcuts import get_object_or_404
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Movie
from engagement.models import Favorite, Interaction, NotInterested, Rating
from engagement.serializers import (
    FavoriteSerializer,
    InteractionSerializer,
    NotInterestedSerializer,
    RatingSerializer,
)


class RatingViewSet(viewsets.ModelViewSet):
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Rating.objects.filter(user=self.request.user).select_related("movie")
        stars = self.request.query_params.get("stars")
        if stars is not None:
            try:
                v = int(stars)
                if 1 <= v <= 5:
                    qs = qs.filter(stars=v)
            except ValueError:
                pass
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]
    lookup_field = "movie__slug"
    lookup_url_kwarg = "movie_slug"

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("movie")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotInterestedViewSet(viewsets.ModelViewSet):
    serializer_class = NotInterestedSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]
    lookup_field = "movie__slug"
    lookup_url_kwarg = "movie_slug"

    def get_queryset(self):
        return NotInterested.objects.filter(user=self.request.user).select_related("movie")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MovieEngagementStateView(APIView):
    """Single round-trip for detail page: stars + favorite + not-interested flags."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        movie = get_object_or_404(Movie, slug=slug)
        r = Rating.objects.filter(user=request.user, movie=movie).first()
        return Response(
            {
                "stars": r.stars if r else None,
                "favorited": Favorite.objects.filter(user=request.user, movie=movie).exists(),
                "not_interested": NotInterested.objects.filter(user=request.user, movie=movie).exists(),
            }
        )


class InteractionViewSet(viewsets.ModelViewSet):
    serializer_class = InteractionSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Interaction.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        profile = getattr(self.request.user, "profile", None)
        variant_key = getattr(getattr(profile, "ab_variant", None), "key", "") or ""
        serializer.save(user=self.request.user, ab_variant_key=variant_key)

