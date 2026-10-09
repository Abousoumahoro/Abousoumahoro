FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
# Base de données et secret : dans un volume pour ne rien perdre aux mises à jour.
ENV DOSSIER_DONNEES=/donnees
VOLUME /donnees
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/sante || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
