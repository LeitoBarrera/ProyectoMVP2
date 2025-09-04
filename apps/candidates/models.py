# apps/candidates/models.py
from django.db import models

class Candidato(models.Model):
    # Ya existentes:
    nombre = models.CharField(max_length=150)
    apellido = models.CharField(max_length=150)
    cedula = models.CharField(max_length=50, unique=True)
    email = models.EmailField()
    celular = models.CharField(max_length=50, blank=True, null=True)
    ciudad_residencia = models.CharField(max_length=120, blank=True, null=True)

    # Nuevos (bio)
    TIPO_DOC = [
        ("CC", "Cédula de ciudadanía"),
        ("TI", "Tarjeta de identidad"),
        ("CE", "Cédula de extranjería"),
        ("PA", "Pasaporte"),
    ]
    tipo_documento = models.CharField(max_length=2, choices=TIPO_DOC, blank=True, null=True)

    fecha_nacimiento = models.DateField(blank=True, null=True)
    estatura_cm = models.PositiveSmallIntegerField(blank=True, null=True)  # estatura en cm

    GRUPO_SANG = [
        ("O-", "O-"), ("O+", "O+"),
        ("A-", "A-"), ("A+", "A+"),
        ("B-", "B-"), ("B+", "B+"),
        ("AB-","AB-"),("AB+","AB+"),
    ]
    grupo_sanguineo = models.CharField(max_length=3, choices=GRUPO_SANG, blank=True, null=True)

    SEXO = [("M","Masculino"),("F","Femenino"),("X","Otro/No binario")]
    sexo = models.CharField(max_length=1, choices=SEXO, blank=True, null=True)

    fecha_expedicion = models.DateField(blank=True, null=True)

    direccion = models.CharField(max_length=200, blank=True, null=True)
    barrio = models.CharField(max_length=120, blank=True, null=True)

    # Guardamos nombre y "id" del API para robustez
    departamento_id = models.CharField(max_length=20, blank=True, null=True)
    departamento_nombre = models.CharField(max_length=120, blank=True, null=True)
    municipio_id = models.CharField(max_length=20, blank=True, null=True)
    municipio_nombre = models.CharField(max_length=120, blank=True, null=True)

    comuna = models.CharField(max_length=50, blank=True, null=True)
    ESTRATO = [(str(i), f"Estrato {i}") for i in range(1,7)]
    estrato = models.CharField(max_length=1, choices=ESTRATO, blank=True, null=True)

    TIPO_ZONA = [("URBANO","Urbano"),("RURAL","Rural")]
    tipo_zona = models.CharField(max_length=6, choices=TIPO_ZONA, blank=True, null=True)

    telefono = models.CharField(max_length=50, blank=True, null=True)
    eps = models.CharField(max_length=120, blank=True, null=True)
    caja_compensacion = models.CharField(max_length=120, blank=True, null=True)
    pension_fondo = models.CharField(max_length=120, blank=True, null=True)
    cesantias_fondo = models.CharField(max_length=120, blank=True, null=True)
    sisben = models.CharField(max_length=50, blank=True, null=True)

    perfil_aspirante = models.TextField(blank=True, null=True)
    redes_sociales = models.JSONField(default=dict, blank=True, null=True)  

    estudia_actualmente = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.nombre} {self.apellido} ({self.cedula})"
