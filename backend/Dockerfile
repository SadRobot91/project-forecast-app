FROM node:24-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
RUN pnpm install --filter project-forecast-backend...
COPY backend ./backend
WORKDIR /app/backend
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "dev"]
