#!/bin/bash
set -e

# Script para fazer rollback para versão anterior

echo "⚠️  Iniciando rollback..."

# Verificar se há backup
if [ ! -d ".backup" ]; then
  echo "❌ Erro: Não há backup disponível"
  exit 1
fi

# Parar serviços atuais
echo "🛑 Parando serviços atuais..."
docker compose down

# Restaurar backup
echo "♻️  Restaurando versão anterior..."
cp .backup/docker-compose.yml docker-compose.yml

# Subir serviços
echo "🚀 Iniciando serviços..."
docker compose pull
docker compose up -d

# Aguardar serviços ficarem prontos
echo "⏳ Aguardando serviços..."
sleep 10

# Verificar saúde
echo "🔍 Verificando saúde dos serviços..."
./scripts/deploy/check-services.sh

echo "✅ Rollback concluído com sucesso!"

