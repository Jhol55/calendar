# Script PowerShell para testar Judge0
Write-Host "🧪 Testando configuração do Judge0..." -ForegroundColor Cyan
Write-Host ""

# Verificar containers
Write-Host "📦 Verificando containers..." -ForegroundColor Yellow
docker ps --filter name=judge0 --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
Write-Host ""

# Logs do Redis
Write-Host "📊 Logs do Redis (últimas 10 linhas):" -ForegroundColor Yellow
docker logs judge0-redis --tail 10 2>&1
Write-Host ""

# Logs do Worker
Write-Host "👷 Logs do Worker (últimas 15 linhas):" -ForegroundColor Yellow
docker logs judge0-worker --tail 15 2>&1
Write-Host ""

# Testar Redis
Write-Host "🔌 Testando conexão Redis..." -ForegroundColor Yellow
try {
    $redisTest = docker exec judge0-redis redis-cli --no-auth-warning -a "YourSecureRedisPasswordHere123!" ping 2>&1
    if ($redisTest -match "PONG") {
        Write-Host "✅ Redis respondendo" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis não está respondendo" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro ao testar Redis" -ForegroundColor Red
}
Write-Host ""

# Testar API
Write-Host "🌐 Testando API do Judge0..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:2358/about" -ErrorAction Stop
    Write-Host "✅ API Judge0 respondendo" -ForegroundColor Green
    Write-Host ""
    Write-Host "📄 Informações do Judge0:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ API Judge0 não está respondendo" -ForegroundColor Red
    Write-Host "Erro: $_" -ForegroundColor Red
}
Write-Host ""

# Testar execução de código
Write-Host "🚀 Testando execução de código JavaScript..." -ForegroundColor Yellow
$body = @{
    source_code = 'console.log("Hello from Judge0!")'
    language_id = 63
    stdin = ""
} | ConvertTo-Json

try {
    $execResponse = Invoke-RestMethod -Uri "http://localhost:2358/submissions?wait=true" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    if ($execResponse.stdout -match "Hello from Judge0") {
        Write-Host "✅ Código executado com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📤 Output:" -ForegroundColor Cyan
        Write-Host $execResponse.stdout
    } else {
        Write-Host "❌ Erro ao executar código" -ForegroundColor Red
        Write-Host "Response:" -ForegroundColor Yellow
        $execResponse | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "❌ Erro ao executar código" -ForegroundColor Red
    Write-Host "Erro: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ Teste concluído!" -ForegroundColor Green

