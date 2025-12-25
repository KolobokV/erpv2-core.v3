# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY package-lock.json* pnpm-lock.yaml* yarn.lock* ./

RUN set -eux; \
    if [ -f package-lock.json ]; then \
        npm ci; \
    elif [ -f pnpm-lock.yaml ]; then \
        npm install -g pnpm && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
        npm install -g yarn && yarn install --frozen-lockfile; \
    else \
        npm install; \
    fi

COPY . .

RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY --from=build /app/dist ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
