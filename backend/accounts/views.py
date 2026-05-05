from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    base = (request.data.get("username") or email.split("@")[0]).strip()[:140]
    username = base or "user"
    n = 0
    while User.objects.filter(username=username).exists():
        n += 1
        username = f"{base}{n}"[:150]

    if not email or not password:
        return Response(
            {"detail": "email and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(email=email).exists():
        return Response({"detail": "email already registered"}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
    )
    token, _ = Token.objects.get_or_create(user=user)

    return Response({"token": token.key, "user_id": user.pk, "email": user.email})
