FROM node:20-slim

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

EXPOSE 8080

CMD ["node", "index.js"]
