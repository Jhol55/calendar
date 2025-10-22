#!/bin/bash

echo "🧪 Testando configuração do Judge0..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se os containers estão rodando
echo "📦 Verificando containers..."
docker ps --filter name=judge0 --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Verificar logs do Redis
echo "📊 Logs do Redis (últimas 10 linhas):"
docker logs judge0-redis --tail 10 2>&1
echo ""

# Verificar logs do Worker
echo "👷 Logs do Worker (últimas 15 linhas):"
docker logs judge0-worker --tail 15 2>&1
echo ""

# Testar conexão Redis
echo "🔌 Testando conexão Redis..."
if docker exec judge0-redis redis-cli --no-auth-warning -a "YourSecureRedisPasswordHere123!" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis respondendo${NC}"
else
    echo -e "${RED}❌ Redis não está respondendo${NC}"
fi
echo ""

# Testar API do Judge0
echo "🌐 Testando API do Judge0..."
if curl -s http://localhost:2358/about > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Judge0 respondendo${NC}"
    echo ""
    echo "📄 Informações do Judge0:"
    curl -s http://localhost:2358/about | jq '.' 2>/dev/null || curl -s http://localhost:2358/about
else
    echo -e "${RED}❌ API Judge0 não está respondendo${NC}"
fi
echo ""

# Testar submissão de código simples
echo "🚀 Testando execução de código JavaScript..."
RESPONSE=$(curl -s -X POST http://localhost:2358/submissions?wait=true \
  -H "Content-Type: application/json" \
  -d '{
    "source_code": "console.log(\"Hello from Judge0!\")",
    "language_id": 63,
    "stdin": ""
  }')

if echo "$RESPONSE" | grep -q "Hello from Judge0"; then
    echo -e "${GREEN}✅ Código executado com sucesso!${NC}"
    echo ""
    echo "📤 Output:"
    echo "$RESPONSE" | jq -r '.stdout' 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}❌ Erro ao executar código${NC}"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo "✨ Teste concluído!"

