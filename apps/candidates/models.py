from django.db import models

class Candidato(models.Model):
    nombre = models.CharField(max_length=150)
    apellido = models.CharField(max_length=150)
    cedula = models.CharField(max_length=20, unique=True)
    email = models.EmailField()
    celular = models.CharField(max_length=30, blank=True)
    ciudad_residencia = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} {self.apellido} ({self.cedula})"
