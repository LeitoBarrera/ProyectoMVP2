from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import MeSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(MeSerializer(request.user).data)
