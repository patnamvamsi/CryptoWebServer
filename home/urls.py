from django.contrib import admin
from django.urls import path, include
from home import views

urlpatterns = [
    path ('', views.home, name = 'home'),
    path('binance', views.binance, name='binance'),
    path('historicaldata', views.historicaldata, name='historicaldata'),
    path('screener', views.screener, name='screener'),
    path('backtesting', views.backtesting, name='backtesting'),
    path('papertrading', views.papertrading, name='papertrading')
]