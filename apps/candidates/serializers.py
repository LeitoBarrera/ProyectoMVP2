# apps/candidates/serializers.py
from rest_framework import serializers
from .models import Candidato

class CandidatoBioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidato
        fields = [
            "id","nombre","apellido","cedula","email","celular","ciudad_residencia",
            "tipo_documento","fecha_nacimiento","estatura_cm","grupo_sanguineo","sexo",
            "fecha_expedicion","direccion","barrio",
            "departamento_id","departamento_nombre","municipio_id","municipio_nombre",
            "comuna","estrato","tipo_zona","telefono","eps","caja_compensacion",
            "pension_fondo","cesantias_fondo","sisben",
            "perfil_aspirante","redes_sociales","estudia_actualmente",
        ]
