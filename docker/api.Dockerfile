FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps apps
COPY packages packages
RUN npm ci --ignore-scripts
RUN npm run db:generate && npm run build:api
CMD ["npm", "run", "start:prod", "--workspace=@pumpnow/api"]
