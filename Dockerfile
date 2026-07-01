# ============================================================
# Multi-stage Dockerfile
# Stage 1: Build React frontend
# Stage 2: Python backend (FastAPI)
# ============================================================

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# Install dependencies first (layer cached separately from source)
COPY frontend/package*.json ./
RUN npm ci --silent

# Copy source and build production bundle
COPY frontend/ ./
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: Python Backend ───────────────────────────────────
FROM python:3.9-slim AS backend

# Environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached layer — only re-runs if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformer model into a cached layer
# This ensures Docker layer cache prevents re-downloading on every rebuild
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy application code
COPY app/ ./app/
COPY shl_product_catalog.json .
COPY precompute_embeddings.py .

# Precompute catalog embeddings into the image
RUN python precompute_embeddings.py

# Copy built frontend into a static directory served by nginx in docker-compose
# (The frontend is served separately via nginx in docker-compose.yml)

# Expose API port
EXPOSE 8000

# Health check for container orchestrators (Kubernetes, ECS, etc.)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
