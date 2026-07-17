FROM node:22-bookworm

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/research/package.json ./packages/research/package.json
COPY packages/audio-synth/package.json ./packages/audio-synth/package.json
COPY packages/visual-synth/package.json ./packages/visual-synth/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY packages ./packages

CMD ["pnpm", "run", "pipeline"]
