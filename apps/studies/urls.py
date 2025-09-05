from rest_framework.routers import DefaultRouter
from .views import SolicitudViewSet, EstudioViewSet, EstudioItemViewSet,AcademicoViewSet,LaboralViewSet

router = DefaultRouter()
router.register(r"solicitudes", SolicitudViewSet, basename="solicitud")
router.register(r"estudios", EstudioViewSet, basename="estudio")
router.register(r"items", EstudioItemViewSet, basename="item")

# NUEVO:
router.register(r"academicos", AcademicoViewSet, basename="academico")
router.register(r"laborales", LaboralViewSet, basename="laboral")

urlpatterns = router.urls
