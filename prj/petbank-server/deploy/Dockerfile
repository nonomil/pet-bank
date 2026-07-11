FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY db ./db

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/main.mjs"]
