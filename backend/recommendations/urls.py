from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token

from accounts.views import register
from recommendations.views import (
    ABMetricsView,
    DiscoveryChatView,
    FeedView,
    MovieExplainView,
    NLPreferenceView,
    ProfileSummaryView,
    health,
)

urlpatterns = [
    path("health/", health),
    path("auth/register/", register),
    path("auth/login/", obtain_auth_token),
    path("feed/", FeedView.as_view()),
    path("movies/<slug:slug>/explain/", MovieExplainView.as_view()),
    path("preferences/nl/", NLPreferenceView.as_view()),
    path("profile/me/", ProfileSummaryView.as_view()),
    path("chat/discovery/", DiscoveryChatView.as_view()),
    path("admin/ab-metrics/", ABMetricsView.as_view()),
]
