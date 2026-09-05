FROM python:3.8

COPY . /CryptoWebServer

WORKDIR /CryptoWebServer

RUN pip3 install -r requirements.txt

ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE CryptoWebServer.settings

# Collect static files for WhiteNoise to serve
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Use Daphne ASGI server for WebSocket support (instead of Django runserver)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "CryptoWebServer.asgi:application"]

#  build an image using this command: sudo docker build -t cryptowebserver:0.1 .
#  run the image using this command: sudo docker run -p 8000:8000 --name cryptowebserver cryptowebserver:0.1
#  NOTE: Now uses Daphne ASGI server for WebSocket support (real-time price updates)