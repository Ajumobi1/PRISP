FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r backend/requirements.txt

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

WORKDIR /app
COPY . .

WORKDIR /app/frontend
RUN NEXT_TELEMETRY_DISABLED=1 npm run build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONUNBUFFERED=1
ENV BACKEND_PORT=8000
ENV PORT=3000

EXPOSE 3000

CMD ["bash", "./docker-start.sh"]
