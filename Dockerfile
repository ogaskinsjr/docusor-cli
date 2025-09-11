# Dockerfile
FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    curl jq ca-certificates docker.io docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# default: run against README.md in /workspace
CMD ["node","src/index.js","/workspace/README.md"]
