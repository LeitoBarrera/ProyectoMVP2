from django.db import models
from django.utils import timezone

class Solicitud(models.Model):
    empresa = models.ForeignKey("accounts.Empresa", on_delete=models.CASCADE)
    candidato = models.ForeignKey("candidates.Candidato", on_delete=models.CASCADE)
    analista = models.ForeignKey("accounts.User", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="solicitudes")
    estado = models.CharField(max_length=30, default="CREADA")  # CREADA, EN_PROCESO, COMPLETADA
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Solicitud {self.id} - {self.candidato}"

class Estudio(models.Model):
    solicitud = models.OneToOneField("studies.Solicitud", on_delete=models.CASCADE, related_name="estudio")
    autorizacion_firmada = models.BooleanField(default=False)
    autorizacion_fecha = models.DateTimeField(null=True, blank=True)
    progreso = models.FloatField(default=0.0)
    score_cuantitativo = models.FloatField(default=0.0)
    nivel_cualitativo = models.CharField(max_length=20, default="BAJO")
    updated_at = models.DateTimeField(auto_now=True)

    def _nivel_por_score(self, score):
        if score >= 75: return "CRITICO"
        if score >= 50: return "ALTO"
        if score >= 25: return "MEDIO"
        return "BAJO"

    def recalcular(self):
        items = self.items.all()
        total = items.count() or 1
        done = items.filter(estado__in=["VALIDADO","CERRADO"]).count()
        self.progreso = round((done/total)*100.0, 1)
        self.score_cuantitativo = round(sum(i.puntaje for i in items), 1)
        self.nivel_cualitativo = self._nivel_por_score(self.score_cuantitativo)
        self.save()

class ItemTipo(models.TextChoices):
    LISTAS_RESTRICTIVAS = "LISTAS_RESTRICTIVAS"
    TITULOS_ACADEMICOS = "TITULOS_ACADEMICOS"
    CERT_LABORALES = "CERT_LABORALES"
    VISITA_DOMICILIARIA = "VISITA_DOMICILIARIA"

class EstudioItem(models.Model):
    estudio = models.ForeignKey(Estudio, on_delete=models.CASCADE, related_name="items")
    tipo = models.CharField(max_length=40, choices=ItemTipo.choices)
    estado = models.CharField(max_length=20, default="PENDIENTE")  # PENDIENTE, EN_VALIDACION, VALIDADO, HALLAZGO, CERRADO
    puntaje = models.FloatField(default=0.0)
    comentario = models.TextField(blank=True)  # <-- NUEVO
    created_at = models.DateTimeField(auto_now_add=True)

    def marcar_validado(self, puntaje=0.0):
        self.estado = "VALIDADO"
        self.puntaje = puntaje
        self.save()
        self.estudio.recalcular()

class ConsentimientoTipo(models.TextChoices):
    GENERAL   = "GENERAL",   "Autorización de tratamiento de datos"
    CENTRALES = "CENTRALES", "Consulta en centrales de riesgo"
    ACADEMICO = "ACADEMICO", "Verificación académica"

class EstudioConsentimiento(models.Model):  
    estudio = models.ForeignKey("Estudio", related_name="consentimientos", on_delete=models.CASCADE)
    tipo = models.CharField(max_length=20, choices=ConsentimientoTipo.choices)
    aceptado = models.BooleanField(default=False)
    firmado_at = models.DateTimeField(null=True, blank=True)
    firma = models.FileField(upload_to="firmas/", null=True, blank=True)  # PNG
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("estudio", "tipo")

    def __str__(self):
        return f"{self.estudio_id} - {self.tipo} - {'OK' if self.aceptado else 'PENDIENTE'}"
    

class Academico(models.Model):
    TIPO_ARCHIVO = (
        ("DIPLOMA", "Diploma"),
        ("ACTA", "Acta de grado"),
        ("OTRO", "Otro"),
    )

    estudio = models.ForeignKey(
        "studies.Estudio", related_name="academicos",
        on_delete=models.CASCADE, null=True, blank=True
    )
    candidato = models.ForeignKey(
        "candidates.Candidato", related_name="academicos",
        on_delete=models.CASCADE
    )

    # ▼▼▼ CAMPOS NUEVOS ▼▼▼
    grado = models.CharField(max_length=120, blank=True, default="")
    acta_numero = models.CharField(max_length=120, blank=True, default="")
    folio_numero = models.CharField(max_length=120, blank=True, default="")
    libro_registro = models.CharField(max_length=120, blank=True, default="")
    rector = models.CharField(max_length=255, blank=True, default="")
    secretario = models.CharField(max_length=255, blank=True, default="")
    concepto = models.TextField(blank=True, default="")
    # ▲▲▲ CAMPOS NUEVOS ▲▲▲

    titulo = models.CharField(max_length=255)
    institucion = models.CharField(max_length=255)
    fecha_graduacion = models.DateField(null=True, blank=True)
    ciudad = models.CharField(max_length=120, blank=True)
    presenta_original = models.BooleanField(default=False)

    archivo = models.FileField(upload_to="academicos/", null=True, blank=True)
    archivo_tipo = models.CharField(max_length=10, choices=TIPO_ARCHIVO, default="DIPLOMA")

    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado"]

    def __str__(self):
        return f"{self.titulo} · {self.institucion}"


class Laboral(models.Model):
    TIPO_CONTRATO = (
        ("FIJO", "Fijo"),
        ("INDEFINIDO", "Indefinido"),
        ("OBRA", "Obra/Labor"),
        ("OTRO", "Otro"),
    )

    estudio = models.ForeignKey(
        "studies.Estudio", related_name="laborales",
        on_delete=models.CASCADE, null=True, blank=True
    )
    candidato = models.ForeignKey(
        "candidates.Candidato", related_name="laborales",
        on_delete=models.CASCADE
    )

    empresa = models.CharField(max_length=255)
    cargo = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=100, blank=True)
    email_contacto = models.EmailField(blank=True)
    direccion = models.CharField(max_length=255, blank=True)

    ingreso = models.DateField(null=True, blank=True)
    retiro = models.DateField(null=True, blank=True)
    motivo_retiro = models.CharField(max_length=255, blank=True)

    tipo_contrato = models.CharField(max_length=12, choices=TIPO_CONTRATO, blank=True)
    jefe_inmediato = models.CharField(max_length=255, blank=True)
    verificada_camara = models.BooleanField(default=False)
    volveria_contratar = models.BooleanField(null=True, blank=True)  # Sí/No/No sabe

    concepto = models.TextField(blank=True)

    certificado = models.FileField(upload_to="laborales/", null=True, blank=True)

    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado"]

    def __str__(self):
        return f"{self.empresa} · {self.cargo or ''}".strip()

