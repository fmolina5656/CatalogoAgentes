# Un solo contenedor: compila el front (Vite) y lo sirve FastAPI junto con el API.
# azd lo construye en Azure Container Registry (remoteBuild), no hace falta Docker local.

FROM node:22-alpine AS front
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/app backend/app
COPY backend/seed backend/seed
COPY catalogo.config.json ./
COPY --from=front /src/frontend/dist frontend/dist
RUN useradd --create-home --uid 10001 app && mkdir -p /app/data && chown app /app/data
USER app
EXPOSE 8000
CMD ["uvicorn", "--factory", "app.main:create_app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
