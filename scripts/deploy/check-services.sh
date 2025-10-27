#!/bin/bash
set -e

# Script para verificar a saúde dos serviços após deploy

echo "🔍 Verificando status dos serviços..."

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar serviço
check_service() {
  local service=$1
  local url=$2
  local max_attempts=30
  local attempt=1
  
  echo -n "Verificando $service... "
  
  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ OK${NC}"
      return 0
    fi
    
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  
  echo -e "${RED}✗ FALHOU${NC}"
  return 1
}

# Verificar Docker Compose
if ! docker compose ps | grep -q "Up"; then
  echo -e "${RED}Erro: Serviços não estão rodando${NC}"
  docker compose ps
  exit 1
fi

echo -e "${GREEN}✓ Docker Compose está ativo${NC}"

# Verificar banco de dados
echo -n "Verificando PostgreSQL... "
if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FALHOU${NC}"
  exit 1
fi

# Verificar Redis
echo -n "Verificando Redis... "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FALHOU${NC}"
  exit 1
fi

# Verificar aplicação (assumindo que está na porta 3001)
check_service "Aplicação" "http://localhost:3001/api/health" || exit 1

# Verificar logs por erros recentes
echo ""
echo "📋 Últimos logs da aplicação:"
docker compose logs --tail=20 app

echo ""
echo "📋 Últimos logs do worker:"
docker compose logs --tail=20 worker

# Verificar uso de recursos
echo ""
echo "💻 Uso de recursos:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo -e "${GREEN}✅ Todos os serviços estão funcionando corretamente!${NC}"

