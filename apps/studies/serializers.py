# apps/studies/serializers.py
from rest_framework import serializers

from .models import Solicitud, Estudio, EstudioItem, EstudioConsentimiento
from apps.candidates.models import Candidato
from apps.documents.serializers import DocumentoSerializer  # nested docs en items


# ---- Candidato embebido en creación de Solicitud ----
class CandidatoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidato
        fields = [
            "id", "nombre", "apellido", "cedula",
            "email", "celular", "ciudad_residencia"
        ]


from apps.accounts.models import Empresa  # <-- agrega este import

class SolicitudCreateSerializer(serializers.ModelSerializer):
    candidato = CandidatoSerializer()
    # 👇 ESTA LÍNEA HACE QUE NO SEA REQUERIDO EN EL PAYLOAD
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all(), required=False)

    class Meta:
        model = Solicitud
        fields = ["id", "empresa", "candidato", "analista", "estado", "created_at"]
        read_only_fields = ["id", "estado", "created_at"]

    def create(self, validated_data):
        cand_data = validated_data.pop("candidato")
        candidato, _ = Candidato.objects.get_or_create(
            cedula=cand_data["cedula"], defaults=cand_data
        )
        # tomamos empresa del context o de validated_data si llegara
        empresa = validated_data.pop("empresa", None) or self.context.get("empresa")
        if empresa is None:
            # Devuelve un JSON de error claro
            raise serializers.ValidationError({"empresa": ["Empresa no especificada."]})

        solicitud = Solicitud.objects.create(empresa=empresa, candidato=candidato, **validated_data)
        Estudio.objects.create(solicitud=solicitud)
        return solicitud



# ---- Ítems del estudio, con documentos anidados ----
class EstudioItemSerializer(serializers.ModelSerializer):
    documentos = DocumentoSerializer(many=True, read_only=True)  # usa contexto para URLs absolutas

    class Meta:
        model = EstudioItem
        fields = ["id", "tipo", "estado", "puntaje", "comentario", "created_at", "documentos"]


# ---- Estudio completo con items ----
class EstudioSerializer(serializers.ModelSerializer):
    solicitud_id = serializers.IntegerField(source="solicitud.id", read_only=True)
    items = EstudioItemSerializer(many=True, read_only=True)

    class Meta:
        model = Estudio
        fields = [
            "id", "solicitud_id",
            "autorizacion_firmada", "autorizacion_fecha",
            "progreso", "score_cuantitativo", "nivel_cualitativo",
            "items",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        rol = getattr(getattr(request, "user", None), "rol", None)

        # Segmentación por rol (como ya teníamos):
        if rol == "CLIENTE":
            for it in data.get("items", []):
                it.pop("puntaje", None)
        elif rol == "CANDIDATO":
            data.pop("score_cuantitativo", None)
            data.pop("nivel_cualitativo", None)

        return data

class EstudioConsentimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstudioConsentimiento
        fields = ["id", "tipo", "aceptado", "firmado_at", "firma"]