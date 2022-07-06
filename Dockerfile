FROM python:3.8

COPY . /CryptoWebServer

WORKDIR /CryptoWebServer

RUN pip3 install -r requirements.txt

ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE CryptoWebServer.settings

EXPOSE 8000

CMD ["python","/CryptoWebServer/manage.py", "runserver","0.0.0.0:8000"]

#  build an image using this command: sudo docker build -t cryptowebserver:0.1 .
#  run the image using this command: sudo docker run -p 8000:8000 --name cryptowebserver cryptowebserver:0.1