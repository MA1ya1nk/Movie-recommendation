from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny

from catalog.models import Movie
from catalog.serializers import MovieDetailSerializer, MovieListSerializer


class MovieViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Movie.objects.all().prefetch_related("genres")
    lookup_field = "slug"
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MovieDetailSerializer
        return MovieListSerializer
