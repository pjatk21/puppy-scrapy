FROM node:18 AS builder

RUN apt update && apt install git bash

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json /app/package.json

COPY yarn.lock /app/yarn.lock

RUN yarn install --ignore-optional

COPY . /app

RUN yarn graphql-codegen

RUN yarn build

ENV NODE_ENV=production \
    TZ=Europe/Warsaw

RUN yarn install

FROM node:18-slim AS target

ENV NODE_ENV=production \
    TZ=Europe/Warsaw

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules

COPY --from=builder /app/package.json .

COPY --from=builder /app/yarn.lock .

COPY --from=builder /app/dist /app/dist

CMD ["yarn", "docker.entrypoint.stealer"]
