FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend

COPY frontend ./frontend

RUN mkdir -p /app/backend/instance

EXPOSE 5000

ENV FLASK_DEBUG=0

CMD ["python", "backend/app.py"]