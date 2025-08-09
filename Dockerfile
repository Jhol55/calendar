# Estágio 1: Build das Dependências e Aplicação
FROM node:20-alpine AS builder
WORKDIR /app

# Copia os arquivos de configuração de pacotes
# ATENÇÃO: Use package-lock.json, não pnpm-lock.yaml
COPY package.json package-lock.json ./

# Instala as dependências de forma limpa, ignorando scripts para segurança
RUN npm ci --ignore-scripts

COPY --from=deps /app/node_modules ./node_modules

# Copia o restante do código-fonte
COPY . .

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

COPY --from=builder /app/public .public

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

# O healthcheck precisa do curl ou wget
# Use curl pois já é um pacote padrão em muitas imagens
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "curl", "-f", "http://localhost:3000/health" ]

# Comando para rodar a aplicação
CMD HOSTNAME="0.0.0.0 node server.js"