FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY dashboard/package.json dashboard/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
RUN apk add --no-cache git ca-certificates && mkdir /data && chown node:node /data
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/dashboard/package.json ./dashboard/package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
ENV CONTRIBOLT_DATA_DIR=/data
EXPOSE 5178
ENTRYPOINT ["node","dist/cli.js"]
CMD ["serve"]
