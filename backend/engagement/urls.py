from django.urls import include, path
from rest_framework.routers import DefaultRouter

from engagement.views import (
    FavoriteViewSet,
    InteractionViewSet,
    MovieEngagementStateView,
    NotInterestedViewSet,
    RatingViewSet,
)

router = DefaultRouter()
router.register("ratings", RatingViewSet, basename="rating")
router.register("favorites", FavoriteViewSet, basename="favorite")
router.register("not-interested", NotInterestedViewSet, basename="notinterested")
router.register("interactions", InteractionViewSet, basename="interaction")

urlpatterns = [
    path("state/<slug:slug>/", MovieEngagementStateView.as_view(), name="engagement-state"),
    path("", include(router.urls)),
]
