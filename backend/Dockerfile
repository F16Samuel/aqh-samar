# ==========================================
# Phase 1: Build Dependencies
# ==========================================
FROM python:3.11-slim as builder

WORKDIR /build

# Install compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies to a local path
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==========================================
# Phase 2: Lightweight Runtime Container
# ==========================================
FROM python:3.11-slim as runner

WORKDIR /app

# Copy dependencies from the builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install postgres runtimes and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend codebase
COPY . /app/

# Environment configurations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000

# Write the runtime startup and migration shell script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Running database migrations..."\n\
alembic upgrade head\n\
echo "Starting FastAPI Application Server..."\n\
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4 --proxy-headers --forwarded-allow-ips "*"\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
