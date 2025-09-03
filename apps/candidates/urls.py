from django.urls import path
from .views import CandidatoMeView

urlpatterns = [
    path("me/", CandidatoMeView.as_view(), name="candidato_me"),
]
