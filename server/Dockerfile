# MediMind API server — Railway builds this image.
#
# A Dockerfile is used instead of relying on Railway's auto-detection so the
# build is deterministic: known Node version, lockfile-exact dependencies,
# compiled once, run as a non-root user.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
# Railway injects PORT; 8787 is only the local default.
EXPOSE 8787
CMD ["node", "dist/index.js"]
