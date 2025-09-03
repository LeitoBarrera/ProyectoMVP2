from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Candidato
from .serializers import CandidatoUpdateSerializer

class CandidatoMeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        cand = Candidato.objects.filter(email=request.user.email).first()
        if not cand:
            return Response({"detail":"No hay candidato asociado"}, status=404)
        return Response(CandidatoUpdateSerializer(cand).data)

    def put(self, request):
        cand = Candidato.objects.filter(email=request.user.email).first()
        if not cand:
            return Response({"detail":"No hay candidato asociado"}, status=404)
        ser = CandidatoUpdateSerializer(cand, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
