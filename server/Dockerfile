FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

# Create uploads directory (required for file uploads)
RUN mkdir -p uploads

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
