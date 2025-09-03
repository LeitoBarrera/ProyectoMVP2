from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings

from .models import Solicitud, EstudioItem

@receiver(post_save, sender=Solicitud)
def notificar_solicitud_creada(sender, instance: Solicitud, created, **kwargs):
    if not created:
        return
    # Email a analista (si hay) y al candidato
    asunto = f"Nueva solicitud de estudio #{instance.id}"
    mensaje = f"Se ha creado la solicitud #{instance.id} para el candidato {instance.candidato}."
    destinatarios = []
    if instance.analista and instance.analista.email:
        destinatarios.append(instance.analista.email)
    if instance.candidato.email:
        destinatarios.append(instance.candidato.email)
    if destinatarios:
        send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL if hasattr(settings,"DEFAULT_FROM_EMAIL") else "no-reply@example.com", destinatarios)

@receiver(post_save, sender=EstudioItem)
def notificar_item_validado(sender, instance: EstudioItem, created, **kwargs):
    if created:
        return
    if instance.estado == "VALIDADO":
        estudio = instance.estudio
        solicitud = estudio.solicitud
        asunto = f"Ítem validado en estudio #{estudio.id}"
        mensaje = f"El ítem {instance.tipo} fue validado. Progreso actual: {estudio.progreso}%."
        # Notificar al cliente (contacto empresa) y opcional al candidato
        destinatarios = []
        if solicitud.empresa.email_contacto:
            destinatarios.append(solicitud.empresa.email_contacto)
        if solicitud.candidato.email:
            destinatarios.append(solicitud.candidato.email)
        if destinatarios:
            send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL if hasattr(settings,"DEFAULT_FROM_EMAIL") else "no-reply@example.com", destinatarios)
