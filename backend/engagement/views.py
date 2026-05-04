from rest_framework import permissions, viewsets

from engagement.models import Interaction, Rating
from engagement.serializers import InteractionSerializer, RatingSerializer


class RatingViewSet(viewsets.ModelViewSet):
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Rating.objects.filter(user=self.request.user).select_related("movie")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
