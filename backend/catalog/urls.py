from django.urls import include, path
from rest_framework.routers import DefaultRouter

from catalog.views import MovieViewSet

router = DefaultRouter()
router.register("movies", MovieViewSet, basename="movie")

urlpatterns = [
    path("", include(router.urls)),
]
