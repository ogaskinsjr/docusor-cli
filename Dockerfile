# Dockerfile
FROM node:20-alpine

# Docker CLIENT (no daemon) + small utils
RUN apk add --no-cache docker-cli docker-cli-compose bash curl jq

# Non-root for safer defaults
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app

# Install app deps
COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev
COPY --chown=app:app . .

# Default doc path; can be overridden at runtime
ENV DOC_PATH=/workspace/README.md

# Run your CLI; last arg can be overridden (inline path)
ENTRYPOINT ["node","/app/src/index.js"]
CMD ["/workspace/README.md"]
