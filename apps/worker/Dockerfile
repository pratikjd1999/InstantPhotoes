FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MODELS_DIR=/app/models
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/fetch_models.py scripts/
RUN python scripts/fetch_models.py /app/models

COPY worker ./worker

RUN useradd --create-home --uid 10001 worker
USER worker

EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# One process: the job threads run inside the web server.
CMD ["uvicorn", "worker.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
