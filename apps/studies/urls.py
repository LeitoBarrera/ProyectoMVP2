from rest_framework.routers import DefaultRouter
from .views import SolicitudViewSet, EstudioViewSet, EstudioItemViewSet

router = DefaultRouter()
router.register(r"solicitudes", SolicitudViewSet, basename="solicitud")
router.register(r"estudios", EstudioViewSet, basename="estudio")
router.register(r"items", EstudioItemViewSet, basename="item")

urlpatterns = router.urls
