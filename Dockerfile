# Shop and agent in one container, the way they run locally.
# Render's free tier allows one always-on web service, so both processes share it.

FROM node:22-bookworm-slim AS webbuild
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# A venv keeps pip away from Debian's externally-managed system Python.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY agent/requirements.txt ./agent/requirements.txt
RUN pip install --no-cache-dir -r agent/requirements.txt

COPY agent/ ./agent/

# Next's standalone server bundles its own dependencies, so no node_modules install here.
COPY --from=webbuild /build/.next/standalone ./web/
COPY --from=webbuild /build/.next/static ./web/.next/static
COPY --from=webbuild /build/public ./web/public

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONUNBUFFERED=1
ENV NUM_CPUS=1

EXPOSE 3000
CMD ["./start.sh"]
