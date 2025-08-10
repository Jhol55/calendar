# Estágio 1: Build das Dependências e Aplicação
FROM node:20-alpine AS builder
WORKDIR /app

ARG DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV DATABASE_URL=${DATABASE_URL}

# Copia os arquivos de configuração de pacotes
COPY package.json package-lock.json ./

# "prepare": "test -d .git && husky install && git config --local core.editor cat && git config core.hooksPath .husky/_ || exit 0"
# Instala as dependências de forma limpa, ignorando scripts para segurança --ignore-scripts
RUN npm ci

# Copia o restante do código-fonte
COPY . .

RUN npx prisma generate

# Roda o build do Next.js
RUN npm run build

# ---

# Estágio 2: Imagem de Produção Final
FROM node:20-alpine AS runner

# Define variáveis de ambiente
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Configura permissões e usuário
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Cria o diretório .next e define as permissões
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copia os artefatos de build do estágio 'builder'
# Isso cria uma imagem de produção otimizada e leve
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Configuração de porta e healthcheck
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Comando para rodar a aplicação
# Foi corrigido o formato do comando CMD
CMD ["node", "server.js"]