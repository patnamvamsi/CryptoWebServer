FROM python:3.12

COPY shared /shared
COPY CryptoWebServer /CryptoWebServer

WORKDIR /CryptoWebServer

RUN pip3 install --upgrade pip \
    && pip3 install -e /shared \
    && pip3 install -r requirements.txt

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=CryptoWebServer.settings

# collectstatic imports settings; provide a throwaway key that runtime overrides.
ARG DJANGO_SECRET_KEY=build-time-only-not-for-runtime
ENV DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
ENV SECRET_KEY=${DJANGO_SECRET_KEY}
ENV DEBUG=false
ENV ALLOWED_HOSTS=localhost
ENV APP_NAME=VRITTI

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "CryptoWebServer.asgi:application"]
