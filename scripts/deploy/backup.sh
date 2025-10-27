#!/bin/bash
set -e

# Script para fazer backup antes do deploy

echo "💾 Criando backup..."

# Criar diretório de backup
mkdir -p .backup

# Backup do docker-compose atual
if [ -f "docker-compose.yml" ]; then
  cp docker-compose.yml .backup/docker-compose.yml
  echo "✓ Docker Compose salvo"
fi

# Backup do banco de dados
echo "📦 Fazendo backup do banco de dados..."
timestamp=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U postgres calendar > .backup/db_backup_${timestamp}.sql
echo "✓ Banco de dados salvo: db_backup_${timestamp}.sql"

# Comprimir backups antigos (manter últimos 5)
find .backup -name "db_backup_*.sql" -type f | sort -r | tail -n +6 | xargs -r gzip

echo "✅ Backup concluído!"

