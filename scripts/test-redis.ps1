# Script para testar Redis do Judge0
Write-Host "🔍 Verificando Judge0 Redis..." -ForegroundColor Cyan
Write-Host ""

# Status do container
Write-Host "📦 Status do container:" -ForegroundColor Yellow
docker ps -a --filter name=judge0-redis --format "table {{.Names}}`t{{.Status}}`t{{.State}}"
Write-Host ""

# Health status
Write-Host "💚 Health Check Status:" -ForegroundColor Yellow
docker inspect judge0-redis --format='{{.State.Health.Status}}' 2>&1
Write-Host ""

# Logs recentes
Write-Host "📊 Logs (últimas 20 linhas):" -ForegroundColor Yellow
docker logs judge0-redis --tail 20 2>&1
Write-Host ""

# Tentar conectar
Write-Host "🔌 Testando conexão..." -ForegroundColor Yellow
try {
    $result = docker exec judge0-redis redis-cli --no-auth-warning -a "YourSecureRedisPasswordHere123!" ping 2>&1
    if ($result -match "PONG") {
        Write-Host "✅ Redis está funcionando!" -ForegroundColor Green
        
        # Info do Redis
        Write-Host ""
        Write-Host "📊 Informações do Redis:" -ForegroundColor Cyan
        docker exec judge0-redis redis-cli --no-auth-warning -a "YourSecureRedisPasswordHere123!" INFO server | Select-String "redis_version", "os", "uptime_in_seconds"
    } else {
        Write-Host "❌ Redis não respondeu corretamente" -ForegroundColor Red
        Write-Host "Resposta: $result"
    }
} catch {
    Write-Host "❌ Erro ao conectar: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔧 Comandos úteis:" -ForegroundColor Yellow
Write-Host "  Reiniciar: docker-compose -f docker-compose.dev.yml restart judge0-redis"
Write-Host "  Ver logs: docker logs -f judge0-redis"
Write-Host "  Entrar no container: docker exec -it judge0-redis sh"

