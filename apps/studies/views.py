# apps/studies/views.py
from io import BytesIO
import base64
from django.core.files.base import ContentFile
from django.db import IntegrityError
from django.http import FileResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.conf import settings
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from apps.notifications.models import Notificacion

from .models import Solicitud, Estudio, EstudioItem, ItemTipo,EstudioConsentimiento, ConsentimientoTipo,Academico,Laboral
from .serializers import (
    SolicitudCreateSerializer,
    EstudioSerializer,
    EstudioItemSerializer,
    EstudioConsentimientoSerializer,
    LaboralSerializer, AcademicoSerializer,
)


class SolicitudViewSet(viewsets.ModelViewSet):
    queryset = Solicitud.objects.all().select_related("candidato", "empresa", "analista")
    serializer_class = SolicitudCreateSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        rol = getattr(user, "rol", None)
        if rol == "ADMIN":
            return qs
        if rol == "CLIENTE":
            return qs.filter(empresa=user.empresa)
        if rol == "ANALISTA":
            return qs.filter(analista=user)
        if rol == "CANDIDATO":
            return qs.filter(candidato__email=user.email)
        return qs.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if getattr(self.request.user, "empresa", None):
            ctx["empresa"] = self.request.user.empresa
        return ctx

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        # El cliente no puede forzar otra empresa
        if getattr(request.user, "rol", None) == "CLIENTE":
            data.pop("empresa", None)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_create(self, serializer):
        emp = getattr(self.request.user, "empresa", None)
        if not emp:
            raise ValidationError(
                {"empresa": ["El usuario cliente no tiene empresa asociada."]}
            )

        solicitud = serializer.save(empresa=emp)

        # Estado inicial del flujo
        estado_inicial = getattr(getattr(Solicitud, "Estado", None), "PENDIENTE_INVITACION", "PENDIENTE_INVITACION")
        solicitud.estado = estado_inicial
        solicitud.save(update_fields=["estado"])

        # --- Autoasignar analista (prefiere analista de la misma empresa) ---
        User = get_user_model()
        analista = (
            User.objects.filter(rol="ANALISTA", is_active=True, empresa=emp)
            .order_by("id")
            .first()
            or User.objects.filter(rol="ANALISTA", is_active=True)
            .order_by("id")
            .first()
        )
        if analista and not solicitud.analista_id:
            solicitud.analista = analista
            solicitud.save(update_fields=["analista"])

        # --- Notificación al analista (y correo si tiene email) ---
        if solicitud.analista_id:
            Notificacion.objects.create(
                user=solicitud.analista,
                tipo="NUEVA_SOLICITUD",
                titulo=f"Nueva solicitud #{solicitud.id}",
                cuerpo=(
                    f"Empresa: {solicitud.empresa} – "
                    f"Candidato: {solicitud.candidato.nombre} {solicitud.candidato.apellido} "
                    f"({solicitud.candidato.cedula})"
                ),
                solicitud=solicitud,
            )
            if solicitud.analista.email:
                send_mail(
                    subject=f"Nueva solicitud asignada #{solicitud.id}",
                    message=(
                        f"Se ha creado la solicitud #{solicitud.id} para "
                        f"{solicitud.candidato.nombre} {solicitud.candidato.apellido}."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[solicitud.analista.email],
                    fail_silently=True,  # no rompas el flujo si no hay SMTP
                )

    @action(detail=True, methods=["post"])
    def invitar_candidato(self, request, pk=None):
        """
        Enviar invitación al candidato (crea usuario si no existe).
        Solo ANALISTA/ADMIN.
        """
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

        solicitud = self.get_object()
        cand = solicitud.candidato
        if not cand.email:
            return Response({"detail": "El candidato no tiene email."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(email=cand.email).first()
        temp_password = None

        if not user:
            base_username = cand.email or f"cand_{cand.cedula}"
            username = base_username
            i = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{i}"
                i += 1
            temp_password = get_random_string(10)
            user = User.objects.create_user(
                username=username,
                email=cand.email,
                password=temp_password,
                rol="CANDIDATO",
            )

        frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        link = f"{frontend}/candidato"

        asunto = f"Acceso para completar su estudio (Solicitud #{solicitud.id})"
        if temp_password:
            cuerpo = (
                f"Hola {cand.nombre},\n\n"
                f"Ingresa al portal del candidato y completa tu estudio:\n{link}\n\n"
                f"Usuario: {user.username}\nContraseña temporal: {temp_password}\n"
            )
        else:
            cuerpo = (
                f"Hola {cand.nombre},\n\n"
                f"Ingresa al portal del candidato y completa tu estudio:\n{link}\n"
                f"Si no recuerdas tu clave, solicita recuperación."
            )

        send_mail(
            asunto,
            cuerpo,
            settings.DEFAULT_FROM_EMAIL,
            [cand.email],
            fail_silently=True,  # evita fallar si no hay SMTP configurado
        )

        # Actualiza estado de la solicitud
        try:
            estado_inv = getattr(getattr(Solicitud, "Estado", None), "INVITADO", "INVITADO")
            solicitud.estado = estado_inv
            solicitud.save(update_fields=["estado"])
        except Exception:
            pass

        return Response({"ok": True}, status=status.HTTP_200_OK)


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

        # Filtros opcionales
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
            # Usa la etiqueta legible del choices si existe
            sec = it.get_tipo_display() if hasattr(it, "get_tipo_display") else it.tipo
            secciones.setdefault(sec, {"estado": [], "validados": 0, "hallazgos": 0})
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
            "totales": {"items": total, "validados": validados, "hallazgos": hallazgos},
            "secciones": secciones,
            "autorizacion": {
                "firmada": estudio.autorizacion_firmada,
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
        estudio = self.get_object()
        if getattr(request.user, "rol", None) != "CANDIDATO":
            return Response({"detail": "Solo el candidato puede firmar."}, status=status.HTTP_403_FORBIDDEN)
        estudio.autorizacion_firmada = True
        if hasattr(estudio, "autorizacion_fecha"):
            estudio.autorizacion_fecha = timezone.now()
        estudio.save()
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def agregar_item(self, request, pk=None):
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)
        estudio = self.get_object()
        tipo = request.data.get("tipo", ItemTipo.LISTAS_RESTRICTIVAS)
        item = EstudioItem.objects.create(estudio=estudio, tipo=tipo)
        estudio.recalcular()
        return Response(EstudioItemSerializer(item).data, status=status.HTTP_201_CREATED)

        @action(detail=True, methods=["post"])
        def validar_masivo(self, request, pk=None):
                if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
                    return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

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


        @action(detail=True, methods=["get"])
        def consentimientos(self, request, pk=None):
                est = self.get_object()
                data = EstudioConsentimientoSerializer(
                    est.consentimientos.all(), many=True, context={"request": request}
                ).data
                return Response(data)


        @action(detail=True, methods=["post"])
        def firmar_consentimiento(self, request, pk=None):
                """
                Body JSON:
                {
                "tipo": "GENERAL" | "CENTRALES" | "ACADEMICO",
                "acepta": true,
                "firma_base64": "data:image/png;base64,iVBORw0K..."  (obligatoria si acepta)
                "user_agent": "...",  (opcional)
                }
                Solo CANDIDATO puede firmar el estudio que le pertenece.
                """
                est = self.get_object()
                # Solo el candidato dueño
                if getattr(request.user, "rol", None) != "CANDIDATO" or est.solicitud.candidato.email != request.user.email:
                    return Response({"detail": "Sin permiso."}, status=403)

                tipo = request.data.get("tipo")
                acepta = bool(request.data.get("acepta"))
                firma_b64 = request.data.get("firma_base64", "")
                ua = request.data.get("user_agent", "")
                # IP del request
                ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR")

                if tipo not in {t.value for t in ConsentimientoTipo}:
                    return Response({"detail": "Tipo inválido."}, status=400)

                cons = EstudioConsentimiento.objects.filter(estudio=est, tipo=tipo).first()
                if not cons:
                    return Response({"detail": "Consentimiento no encontrado."}, status=404)

                if acepta:
                    if not firma_b64.startswith("data:image"):
                        return Response({"detail": "Se requiere la imagen de la firma."}, status=400)
                    # parse base64
                    try:
                        header, b64data = firma_b64.split(",", 1)
                    except ValueError:
                        return Response({"detail": "Formato de firma inválido."}, status=400)
                    ext = "png"
                    content = ContentFile(base64.b64decode(b64data), name=f"firma_{est.id}_{tipo}.{ext}")
                    cons.firma = content
                    cons.aceptado = True
                    cons.firmado_at = timezone.now()
                    cons.user_agent = ua or None
                    cons.ip = ip or None
                    cons.save()

                    # Si ya se firmaron los 3, marcamos autorizacion_firmada en Estudio
                    total = est.consentimientos.count()
                    ok = est.consentimientos.filter(aceptado=True).count()
                    if total and ok == total:
                        est.autorizacion_firmada = True
                        if hasattr(est, "autorizacion_fecha"):
                            est.autorizacion_fecha = timezone.now()
                        est.save(update_fields=["autorizacion_firmada", "autorizacion_fecha"] if hasattr(est, "autorizacion_fecha") else ["autorizacion_firmada"])

                    return Response({"ok": True})

                # Si NO acepta:
                cons.aceptado = False
                cons.firma = None
                cons.firmado_at = None
                cons.user_agent = ua or None
                cons.ip = ip or None
                cons.save()
                # Al negar, aseguramos que el estudio quede sin autorización global
                est.autorizacion_firmada = False
                if hasattr(est, "autorizacion_fecha"):
                    est.autorizacion_fecha = None
                est.save(update_fields=["autorizacion_firmada", "autorizacion_fecha"] if hasattr(est, "autorizacion_fecha") else ["autorizacion_firmada"])

                return Response({"ok": True})

    

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
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)
        item = self.get_object()
        puntaje = float(request.data.get("puntaje", 0) or 0)
        item.marcar_validado(puntaje=puntaje)
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def marcar_hallazgo(self, request, pk=None):
        if getattr(request.user, "rol", None) not in ("ANALISTA", "ADMIN"):
            return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)
        item = self.get_object()
        item.estado = "HALLAZGO"
        item.comentario = request.data.get("comentario", "") or ""
        item.puntaje = float(request.data.get("puntaje", 0) or 0)
        item.save()
        item.estudio.recalcular()
        return Response({"ok": True}, status=status.HTTP_200_OK)

class BaseRolMixin:
    """
    Reutiliza el mismo filtro por rol que ya aplicas en EstudioItemViewSet.
    """
    def filtrar_por_rol(self, qs):
        user = self.request.user
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

    def validar_acceso_a_estudio(self, est: Estudio):
        user = self.request.user
        rol = getattr(user, "rol", None)

        if rol == "ADMIN":
            return
        if rol == "CLIENTE" and est.solicitud.empresa == getattr(user, "empresa", None):
            return
        if rol == "ANALISTA" and est.solicitud.analista_id == getattr(user, "id", None):
            return
        if rol == "CANDIDATO" and est.solicitud.candidato.email == user.email:
            return
        raise ValidationError({"detail": ["No autorizado para este estudio."]})


class AcademicoViewSet(BaseRolMixin, viewsets.ModelViewSet):
    queryset = (
        Academico.objects
        .select_related(
            "estudio",
            "estudio__solicitud",
            "estudio__solicitud__candidato",
            "estudio__solicitud__empresa",
            "estudio__solicitud__analista",
        )
    )
    serializer_class = AcademicoSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        # se mantiene el filtro por rol para listado
        return self.filtrar_por_rol(super().get_queryset())

    def get_object(self):
        """
        Evita 404 por queryset filtrado: busca por PK y luego valida permisos.
        """
        obj = (
            Academico.objects
            .select_related(
                "estudio",
                "estudio__solicitud",
                "estudio__solicitud__candidato",
            )
            .get(pk=self.kwargs["pk"])
        )
        self.validar_acceso_a_estudio(obj.estudio)
        return obj

    def perform_create(self, serializer):
        # (tu código actual tal cual, no lo toco)
        ...

    def perform_update(self, serializer):
        """
        Congela estudio/candidato para que no se intenten mover por error
        y valida permisos sobre el estudio actual.
        """
        instance = serializer.instance
        self.validar_acceso_a_estudio(instance.estudio)
        serializer.save(estudio=instance.estudio, candidato=instance.candidato)

    def perform_destroy(self, instance):
        self.validar_acceso_a_estudio(instance.estudio)
        return super().perform_destroy(instance)

class AcademicoViewSet(BaseRolMixin, viewsets.ModelViewSet):
    serializer_class = AcademicoSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    # queryset base (con select_related útil)
    queryset = (
        Academico.objects.select_related(
            "estudio",
            "estudio__solicitud",
            "estudio__solicitud__candidato",
            "estudio__solicitud__empresa",
            "estudio__solicitud__analista",
        )
    )

    def get_queryset(self):
        # mantén tu lógica de rol aquí (listado)
        return self.filtrar_por_rol(super().get_queryset())

    def get_object(self):
        """
        Evita el 404 de DRF por queryset filtrado: busca por PK
        y luego valida acceso al estudio.
        """
        obj = (
            Academico.objects.select_related(
                "estudio",
                "estudio__solicitud",
                "estudio__solicitud__candidato",
            ).get(pk=self.kwargs["pk"])
        )
        self.validar_acceso_a_estudio(obj.estudio)
        return obj

    def perform_create(self, serializer):
        # (tu código actual SIN cambios)
        est_id = self.request.data.get("estudio") or self.request.query_params.get("estudio")
        est = None
        if est_id:
            try:
                est = Estudio.objects.get(pk=est_id)
            except Estudio.DoesNotExist:
                raise ValidationError({"estudio": ["No existe."]})
        else:
            if getattr(self.request.user, "rol", None) == "CANDIDATO":
                est = (
                    Estudio.objects
                    .filter(solicitud__candidato__email=self.request.user.email)
                    .order_by("-solicitud__created_at")
                    .first()
                )
            if not est:
                raise ValidationError({"estudio": ["Este campo es requerido."]})

        self.validar_acceso_a_estudio(est)
        serializer.save(estudio=est, candidato=est.solicitud.candidato)

    def perform_update(self, serializer):
        """
        Congela estudio/candidato al editar y valida acceso.
        """
        instance = serializer.instance
        self.validar_acceso_a_estudio(instance.estudio)
        serializer.save(estudio=instance.estudio, candidato=instance.candidato)

    def perform_destroy(self, instance):
        self.validar_acceso_a_estudio(instance.estudio)
        return super().perform_destroy(instance)


class LaboralViewSet(BaseRolMixin, viewsets.ModelViewSet):
    queryset = Laboral.objects.all().select_related("estudio", "candidato")
    serializer_class = LaboralSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        est_id = self.request.query_params.get("estudio")
        if est_id:
            qs = qs.filter(estudio_id=est_id)

        # Si es candidato, solo los suyos
        if getattr(self.request.user, "rol", None) == "CANDIDATO":
            qs = qs.filter(candidato__email=self.request.user.email)
        return qs

    def perform_create(self, serializer):
        est_id = self.request.data.get("estudio") or self.request.query_params.get("estudio")
        est = None
        if est_id:
            try:
                est = Estudio.objects.get(pk=est_id)
            except Estudio.DoesNotExist:
                raise ValidationError({"estudio": ["No existe."]})
        else:
            if getattr(self.request.user, "rol", None) == "CANDIDATO":
                est = (
                    Estudio.objects
                    .filter(solicitud__candidato__email=self.request.user.email)
                    .order_by("-solicitud__created_at")
                    .first()
                )
            if not est:
                raise ValidationError({"estudio": ["Este campo es requerido."]})

        self.validar_acceso_a_estudio(est)
        serializer.save(estudio=est, candidato=est.solicitud.candidato)