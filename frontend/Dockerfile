FROM node:24-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
RUN pnpm install --filter project-forecast-frontend...
COPY frontend ./frontend
WORKDIR /app/frontend
EXPOSE 5173
CMD ["pnpm", "dev", "--host"]
