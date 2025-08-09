# Estágio 1: Build da Aplicação
FROM node:18-alpine AS builder
WORKDIR /app

# Copia o package.json e o lockfile
COPY package*.json ./

# Desativa o Husky no build
ENV HUSKY=0

# Instala TODAS as dependências (incluindo dev)
RUN npm ci --ignore-scripts

# Copia o restante do código-fonte
COPY . .

# Roda o build do Next.js
RUN npm run build

# Remove as devDependencies para deixar leve
RUN npm prune --omit=dev

# ---

# Estágio 2: Imagem Final de Produção
FROM node:18-alpine
WORKDIR /app

# Copia as dependências já sem devDependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expõe a porta
EXPOSE 4000

# Inicia o Next.js
CMD ["npm", "start"]
