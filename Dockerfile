FROM node:22-alpine
RUN adduser -D -H appuser
USER appuser
WORKDIR /app
COPY --chown=appuser .output/ /app/.output/
EXPOSE 3001
ENV HOST=0.0.0.0
ENV PORT=3001
CMD ["node", ".output/server/index.mjs"]
