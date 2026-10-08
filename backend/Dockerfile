FROM python:3.12-slim

# Ускоряем pip и ставим системные зависимости для asyncpg/psycopg и т.п.
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update
# && apt-get install -y --no-install-recommends build-essential gcc libpq-dev curl \
# && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pip install --upgrade pip \
 && pip install -r requirements.txt

# Порт uvicorn
EXPOSE 8000

# Команда запуска
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
