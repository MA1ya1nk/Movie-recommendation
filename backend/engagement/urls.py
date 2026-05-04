from django.urls import include, path
from rest_framework.routers import DefaultRouter

from engagement.views import InteractionViewSet, RatingViewSet

router = DefaultRouter()
router.register("ratings", RatingViewSet, basename="rating")
router.register("interactions", InteractionViewSet, basename="interaction")

urlpatterns = [
    path("", include(router.urls)),
]
