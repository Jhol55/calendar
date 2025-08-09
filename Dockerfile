# Estágio 1: Build da Aplicação
FROM node:18-alpine AS builder
WORKDIR /app

# Copia o package.json e o lockfile
COPY package*.json ./

# Instala as dependências de produção
RUN npm install --only=production

# Copia o restante do código-fonte
COPY . .

# Roda o build do Next.js
RUN npm run build

# ---

# Estágio 2: Imagem Final de Produção
FROM node:18-alpine
WORKDIR /app

# Copia as dependências de produção do estágio de build
COPY --from=builder /app/node_modules ./node_modules
# Copia a pasta de build do Next.js
COPY --from=builder /app/.next ./.next
# Copia o package.json
COPY --from=builder /app/package.json ./package.json
# Copia a pasta 'public'
COPY --from=builder /app/public ./public

# Expõe a porta que o Next.js roda
EXPOSE 3000

# Comando para iniciar a aplicação em produção
CMD ["npm", "start"]