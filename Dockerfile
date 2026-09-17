FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json eslint.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY pipeline/data/words.json pipeline/data/vectors.bin pipeline/data/freq.json \
     pipeline/data/synonyms.json pipeline/data/associations.json \
     pipeline/data/pos.json pipeline/data/pairs.json pipeline/data/neighbors60.bin \
     ./pipeline/data/
EXPOSE 3000
CMD ["node", "server.js"]
