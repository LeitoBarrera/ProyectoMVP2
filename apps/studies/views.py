# apps/studies/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from io import BytesIO
from django.http import FileResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


from .models import Solicitud, Estudio, EstudioItem, ItemTipo
from .serializers import (
    SolicitudCreateSerializer,
    EstudioSerializer,
    EstudioItemSerializer,
)


class SolicitudViewSet(viewsets.ModelViewSet):
    queryset = Solicitud.objects.all().select_related("candidato","empresa","analista")
    serializer_class = SolicitudCreateSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.rol == "ADMIN":
            return qs
        if user.rol == "CLIENTE":
            return qs.filter(empresa=user.empresa)
        if user.rol == "ANALISTA":
            return qs.filter(analista=user)
        if user.rol == "CANDIDATO":
            return qs.filter(candidato__email=user.email)
        return qs.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # (no es imprescindible si hacemos perform_create, pero ayuda)
        if getattr(self.request.user, "empresa", None):
            ctx["empresa"] = self.request.user.empresa
        return ctx

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if getattr(request.user, "rol", None) == "CLIENTE":
            data.pop("empresa", None)  # el cliente no puede forzar otra empresa
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        emp = getattr(self.request.user, "empresa", None)
        if not emp:
            # → este es el error claro si el cliente no tiene empresa asociada
            raise ValidationError({"empresa": ["El usuario cliente no tiene empresa asociada."]})
        serializer.save(empresa=emp)


class EstudioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Estudio.objects.all()
        .select_related(
            "solicitud",
            "solicitud__candidato",
            "solicitud__empresa",
            "solicitud__analista",
        )
        .prefetch_related("items", "items__documentos")
    )
    serializer_class = EstudioSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        rol = getattr(user, "rol", None)

        # Scope por rol
        if rol == "ADMIN":
            base = qs
        elif rol == "CLIENTE":
            base = qs.filter(solicitud__empresa=user.empresa)
        elif rol == "ANALISTA":
            base = qs.filter(solicitud__analista=user)
        elif rol == "CANDIDATO":
            base = qs.filter(solicitud__candidato__email=user.email)
        else:
            base = qs.none()

        # ---- Filtros opcionales ----
        estado = self.request.query_params.get("estado")
        if estado:
            base = base.filter(items__estado=estado).distinct()

        desde = self.request.query_params.get("desde")
        hasta = self.request.query_params.get("hasta")
        if desde:
            base = base.filter(solicitud__created_at__date__gte=parse_date(desde))
        if hasta:
            base = base.filter(solicitud__created_at__date__lte=parse_date(hasta))

        cedula = self.request.query_params.get("cedula")
        if cedula:
            base = base.filter(solicitud__candidato__cedula__icontains=cedula)

        return base.order_by("-solicitud__created_at")

    @action(detail=True, methods=["get"])
    def resumen(self, request, pk=None):
        estudio = self.get_object()
        items = estudio.items.all()
        total = items.count()
        validados = items.filter(estado="VALIDADO").count()
        hallazgos = items.filter(estado="HALLAZGO").count()

        secciones = {}
        for it in items:
            sec = it.tipo
            secciones.setdefault(
                sec, {"estado": [], "validados": 0, "hallazgos": 0}
            )
            secciones[sec]["estado"].append(it.estado)
            if it.estado == "VALIDADO":
                secciones[sec]["validados"] += 1
            if it.estado == "HALLAZGO":
                secciones[sec]["hallazgos"] += 1

        resumen = {
            "estudio_id": estudio.id,
            "progreso": estudio.progreso,
            "score_cuantitativo": estudio.score_cuantitativo,
            "nivel_cualitativo": estudio.nivel_cualitativo,
            "totales": {
                "items": total,
                "validados": validados,
                "hallazgos": hallazgos,
            },
            "secciones": secciones,
            "autorizacion": {
                "firmada": estudio.autorizacion_firmada,
                # Cambia este nombre si tu campo es distinto:
                "fecha": getattr(estudio, "autorizacion_fecha", None),
            },
        }

        # Segmentación para candidato
        if getattr(request.user, "rol", None) == "CANDIDATO":
            resumen.pop("score_cuantitativo", None)
            resumen.pop("nivel_cualitativo", None)

        return Response(resumen, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def resumen_pdf(self, request, pk=None):
        # Reusar la lógica del resumen JSON
        resp = self.resumen(request, pk=pk).data

        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        w, h = A4

        y = h - 40
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, f"Resumen Estudio #{resp['estudio_id']}")
        y -= 20
        c.setFont("Helvetica", 10)
        c.drawString(
            40,
            y,
            f"Progreso: {resp.get('progreso', 0)}%   |   Items: {resp['totales']['items']}   "
            f"Validados: {resp['totales']['validados']}   Hallazgos: {resp['totales']['hallazgos']}",
        )
        y -= 20
        c.drawString(
            40,
            y,
            f"Autorización: {'Firmada' if resp['autorizacion']['firmada'] else 'Pendiente'}",
        )
        y -= 20
        c.drawString(40, y, "Secciones:")
        y -= 15

        for sec, info in (resp.get("secciones") or {}).items():
            line = (
                f"- {sec}: ✓ {info['validados']}  |  ⚠ {info['hallazgos']}  |  "
                f"estados: {', '.join(info['estado'][:5])}"
            )
            # wrap rudimentario
            for chunk in [line[i : i + 95] for i in range(0, len(line), 95)]:
                c.drawString(50, y, chunk)
                y -= 14
                if y < 60:
                    c.showPage()
                    y = h - 40
                    c.setFont("Helvetica", 10)

        c.showPage()
        c.save()
        buffer.seek(0)
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"resumen_estudio_{resp['estudio_id']}.pdf",
        )

    @action(detail=True, methods=["post"])
    def firmar_autorizacion(self, request, pk=None):
        # Sólo el candidato de este estudio puede firmar
        estudio = self.get_object()
        if getattr(request.user, "rol", None) != "CANDIDATO":
            return Response(
                {"detail": "Solo el candidato puede firmar."},
                status=status.HTTP_403_FORBIDDEN,
            )
        estudio.autorizacion_firmada = True
        # Cambia el nombre si tu campo es distinto
        if hasattr(estudio, "autorizacion_fecha"):
            estudio.autorizacion_fecha = timezone.now()
        estudio.save()
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def agregar_item(self, request, pk=None):
        # Analista o Admin pueden crear ítems
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response(
                {"detail": "Sin permiso."},
                status=status.HTTP_403_FORBIDDEN,
            )
        estudio = self.get_object()
        tipo = request.data.get("tipo", ItemTipo.LISTAS_RESTRICTIVAS)
        item = EstudioItem.objects.create(estudio=estudio, tipo=tipo)
        estudio.recalcular()
        return Response(
            EstudioItemSerializer(item).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def validar_masivo(self, request, pk=None):
        """
        Body: {
          "items": [
            {"id": 1, "puntaje": 10, "estado": "VALIDADO" | "HALLAZGO", "comentario": "..."},
            ...
          ]
        }
        """
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response(
                {"detail": "Sin permiso."},
                status=status.HTTP_403_FORBIDDEN,
            )

        estudio = self.get_object()
        payload = request.data.get("items", [])
        updated = 0

        for it in payload:
            iid = it.get("id")
            if not iid:
                continue
            try:
                item = estudio.items.get(id=iid)
            except EstudioItem.DoesNotExist:
                continue

            estado = it.get("estado", "VALIDADO")
            puntaje = float(it.get("puntaje", 0) or 0)
            comentario = it.get("comentario", "")

            if estado == "HALLAZGO":
                item.estado = "HALLAZGO"
                item.puntaje = puntaje
                item.comentario = comentario
                item.save()
            else:
                item.marcar_validado(puntaje=puntaje)
                if comentario:
                    item.comentario = comentario
                    item.save()

            updated += 1

        estudio.recalcular()
        return Response({"ok": True, "updated": updated}, status=status.HTTP_200_OK)


class EstudioItemViewSet(viewsets.ModelViewSet):
    queryset = EstudioItem.objects.all()
    serializer_class = EstudioItemSerializer

    def get_queryset(self):
        user = self.request.user
        qs = (
            super()
            .get_queryset()
            .select_related(
                "estudio",
                "estudio__solicitud",
                "estudio__solicitud__candidato",
                "estudio__solicitud__empresa",
                "estudio__solicitud__analista",
            )
            .prefetch_related("documentos")
        )

        rol = getattr(user, "rol", None)
        if rol == "ADMIN":
            return qs
        if rol == "CLIENTE":
            return qs.filter(estudio__solicitud__empresa=user.empresa)
        if rol == "ANALISTA":
            return qs.filter(estudio__solicitud__analista=user)
        if rol == "CANDIDATO":
            return qs.filter(estudio__solicitud__candidato__email=user.email)
        return qs.none()

    @action(detail=True, methods=["post"])
    def validar(self, request, pk=None):
        # Sólo analista/admin valida
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response(
                {"detail": "Sin permiso."},
                status=status.HTTP_403_FORBIDDEN,
            )
        item = self.get_object()
        puntaje = float(request.data.get("puntaje", 0) or 0)
        item.marcar_validado(puntaje=puntaje)
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def marcar_hallazgo(self, request, pk=None):
        """Body: { "comentario": "...", "puntaje": 0 }"""
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response(
                {"detail": "Sin permiso."},
                status=status.HTTP_403_FORBIDDEN,
            )
        item = self.get_object()
        item.estado = "HALLAZGO"
        item.comentario = request.data.get("comentario", "") or ""
        item.puntaje = float(request.data.get("puntaje", 0) or 0)
        item.save()
        item.estudio.recalcular()
        return Response({"ok": True}, status=status.HTTP_200_OK)
