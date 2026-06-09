# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

# Accept build arguments
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_API_AUTH_KEY
ENV VITE_API_AUTH_KEY=$VITE_API_AUTH_KEY

ARG VITE_REVERB_APP_KEY
ENV VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY

ARG VITE_REVERB_HOST
ENV VITE_REVERB_HOST=$VITE_REVERB_HOST

ARG VITE_REVERB_PORT
ENV VITE_REVERB_PORT=$VITE_REVERB_PORT

ARG VITE_REVERB_SCHEME
ENV VITE_REVERB_SCHEME=$VITE_REVERB_SCHEME



COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
