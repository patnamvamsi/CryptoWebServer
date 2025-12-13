from django.urls import path, re_path
from .views import index

urlpatterns = [
    # Catch-all pattern to serve React app for all sub-routes
    # This allows React Router to handle client-side routing
    re_path(r'^.*$', index),
]