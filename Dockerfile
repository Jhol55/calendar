# Estágio 1: Build das Dependências e Aplicação
FROM node:20-alpine AS builder
WORKDIR /app

# Copia os arquivos de configuração de pacotes
COPY package.json package-lock.json ./

# Instala as dependências de forma limpa, ignorando scripts para segurança --ignore-scripts
RUN npm ci --ignore-scripts

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
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma


USER nextjs

# Configuração de porta e healthcheck
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]