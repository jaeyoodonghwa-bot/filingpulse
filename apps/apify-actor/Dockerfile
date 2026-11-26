# Multi-stage build for Apify Store PPE Actor (Node 22 LTS)
FROM apify/actor-node:22 AS builder

WORKDIR /usr/src/app

COPY package.json tsconfig.json ./
COPY vendor ./vendor
COPY src ./src

RUN npm install --include=dev --audit=false --fund=false \
    && npm run build

FROM apify/actor-node:22

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/vendor ./vendor
COPY --from=builder /usr/src/app/dist ./dist
COPY .actor ./.actor

RUN npm install --omit=dev --audit=false --fund=false \
    && rm -rf ~/.npm

CMD ["npm", "start", "--silent"]
