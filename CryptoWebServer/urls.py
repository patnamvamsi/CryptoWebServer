"""CryptoWebServer URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.11/topics/http/urls/
"""
from django.conf.urls import include
from django.urls import re_path, path
from django.contrib import admin
from home import views

urlpatterns = [
    # Django admin
    re_path(r'^admin/', admin.site.urls),
    # Health check endpoint (direct access at /health)
    path('health', views.HealthDashboardAPIView.as_view(), name='health-dashboard'),
    # API endpoints for React frontend (must be before catch-all)
    re_path(r'^api/', include('home.urls')),
    # Catch-all for React Router (must be last)
    re_path(r'^', include('frontend.urls')),
]

