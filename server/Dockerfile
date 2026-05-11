FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

# Repara el módulo nativo de TensorFlow dentro de Linux
RUN npm rebuild @tensorflow/tfjs-node --build-addon-from-source || npm rebuild @tensorflow/tfjs-node

COPY . .

EXPOSE 4000

CMD ["npm", "start"]