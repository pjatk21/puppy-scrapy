FROM node:lts-alpine

RUN apk add chromium git bash

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN adduser -D -s /bin/bash scrapper

WORKDIR /app

RUN chown -R scrapper /app

USER scrapper

COPY --chown=scrapper package.json /app/package.json

COPY --chown=scrapper yarn.lock /app/yarn.lock

RUN yarn install

COPY --chown=scrapper . /app

RUN yarn build

ENV NODE_ENV=production \
    TZ=Europe/Warsaw

ENTRYPOINT yarn start