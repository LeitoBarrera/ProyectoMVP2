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

