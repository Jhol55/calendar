#!/bin/bash
set -e

# Script principal de deploy
# Uso: ./scripts/deploy/deploy.sh [version]

VERSION=${1:-latest}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}

echo "🚀 Iniciando deploy da versão: $VERSION"

# Verificar se estamos no diretório correto
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Erro: $COMPOSE_FILE não encontrado"
  exit 1
fi

# Fazer backup
if [ -f "scripts/deploy/backup.sh" ]; then
  echo "📦 Criando backup..."
  bash scripts/deploy/backup.sh
fi

# Exportar variável de versão
export IMAGE_TAG=$VERSION

# Pull das novas imagens
echo "📥 Baixando novas imagens..."
docker compose -f $COMPOSE_FILE pull

# Executar migrations
echo "🔄 Executando migrations..."
docker compose -f $COMPOSE_FILE run --rm app npx prisma migrate deploy

# Deploy com zero downtime
echo "🔄 Atualizando serviços..."

# Atualizar app
docker compose -f $COMPOSE_FILE up -d --no-deps --force-recreate app
echo "⏳ Aguardando app ficar pronto..."
sleep 10

# Atualizar worker
docker compose -f $COMPOSE_FILE up -d --no-deps --force-recreate worker
echo "⏳ Aguardando worker ficar pronto..."
sleep 5

# Limpar recursos não utilizados
echo "🧹 Limpando recursos antigos..."
docker image prune -af --filter "until=24h"

# Verificar saúde dos serviços
if [ -f "scripts/deploy/check-services.sh" ]; then
  echo "🏥 Verificando saúde dos serviços..."
  bash scripts/deploy/check-services.sh
else
  echo "⏳ Aguardando serviços estabilizarem..."
  sleep 15
  
  # Verificação básica
  if ! docker compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    echo "❌ Erro: Alguns serviços não estão rodando"
    docker compose -f $COMPOSE_FILE ps
    
    # Rollback
    if [ -f "scripts/deploy/rollback.sh" ]; then
      echo "🔄 Executando rollback..."
      bash scripts/deploy/rollback.sh
    fi
    exit 1
  fi
fi

# Mostrar status final
echo ""
echo "📊 Status dos serviços:"
docker compose -f $COMPOSE_FILE ps

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "📝 Versão: $VERSION"
echo "🕐 Data: $(date)"

