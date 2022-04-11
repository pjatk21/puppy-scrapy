FROM node:17-alpine

RUN apk add chromium git bash

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json /app/package.json

COPY yarn.lock /app/yarn.lock

RUN yarn install

COPY . /app

RUN yarn build

ENV NODE_ENV=production \
    TZ=Europe/Warsaw

RUN yarn install

VOLUME [ "/app/passport" ]

ENTRYPOINT ["yarn", "docker.entrypoint.stealer"]
CMD []
