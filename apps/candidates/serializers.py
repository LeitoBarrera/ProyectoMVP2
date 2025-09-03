from rest_framework import serializers
from .models import Candidato

class CandidatoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidato
        fields = ["nombre","apellido","cedula","email","celular","ciudad_residencia"]
        read_only_fields = ["cedula","email"]  # si no quieres que editen estos, ajústalo
