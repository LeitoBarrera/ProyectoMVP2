# apps/candidates/views.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Candidato
from .serializers import CandidatoBioSerializer

class CandidatoMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Encontrar candidato por email de usuario
        cand = Candidato.objects.filter(email=user.email).order_by("-id").first()
        if not cand:
            return Response({"detail": "No se encontró candidato asociado al usuario."}, status=404)
        return Response(CandidatoBioSerializer(cand).data)

    def patch(self, request):
        user = request.user
        cand = Candidato.objects.filter(email=user.email).order_by("-id").first()
        if not cand:
            return Response({"detail": "No se encontró candidato asociado al usuario."}, status=404)
        ser = CandidatoBioSerializer(cand, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=200)
