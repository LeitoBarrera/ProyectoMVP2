from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Documento
from .serializers import DocumentoSerializer

class DocumentoViewSet(viewsets.ModelViewSet):
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer
