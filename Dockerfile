FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# Install dependencies (none currently, but ensures future compatibility)
RUN npm install --production

COPY . .

EXPOSE 9100

ENV PORT=9100

CMD ["node", "server.js"]
