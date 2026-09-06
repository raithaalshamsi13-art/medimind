# Root-level Dockerfile for Railway.
#
# This builds the API server in ./server even when Railway's "Root Directory"
# is left at the repository root. It is the same image as server/Dockerfile,
# just with paths prefixed by server/. The phone app is never built here -
# it runs in Expo Go, and the web build is Vercel's job (vercel.json).

FROM node:22-alpine AS build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
# Railway injects PORT; 8787 is only the local default.
EXPOSE 8787
CMD ["node", "dist/index.js"]
