FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY frontend/ ./frontend/

# Cloud Run uses PORT env var (default 8080)
ENV PORT=8080

# Run with uvicorn
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port $PORT"]
