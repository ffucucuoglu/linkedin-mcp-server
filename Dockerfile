FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENTRYPOINT ["node", "dist/index.js"]
