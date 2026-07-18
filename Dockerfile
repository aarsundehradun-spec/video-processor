FROM node:18-bullseye-slim

# Install system dependencies: ffmpeg, cmake, build-essential (required for Whisper.cpp build)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    cmake \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY download-font.js build-whisper.js ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
