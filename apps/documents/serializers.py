from rest_framework import serializers
from .models import Documento

class DocumentoSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = ["id", "nombre", "tipo", "archivo_url", "created_at", "item"]

    def get_archivo_url(self, obj):
        request = self.context.get("request")
        if not obj.archivo:
            return ""
        url = obj.archivo.url
        return request.build_absolute_uri(url) if request else url