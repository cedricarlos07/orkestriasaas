FROM node:22 AS builder
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://github.com/cedricarlos07/orkestriasaas/archive/refs/heads/master.tar.gz" -o /tmp/src.tar.gz \
  && mkdir -p /tmp/src \
  && tar -xzf /tmp/src.tar.gz -C /tmp/src --strip-components=1
WORKDIR /tmp/src
RUN npm install && npm run build

FROM node:22 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
  && pip3 install --break-system-packages "meta-adkit[mcp]" adloop \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /tmp/src /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
