# Script para debugar Code Execution Node
Write-Host "🔍 Debugging Code Execution Node..." -ForegroundColor Cyan
Write-Host ""

# Pedir o execution ID (ou usar o mais recente)
$executionId = Read-Host "Digite o Execution ID (ou deixe em branco para ver o mais recente)"

if ([string]::IsNullOrWhiteSpace($executionId)) {
    Write-Host "📊 Buscando logs do worker..." -ForegroundColor Yellow
    docker logs --tail 100 -f calendar-webhook-worker-1 2>&1 | Select-String "CODE-EXECUTION", "Variable Context", "Resolved input vars", "node_", "error"
} else {
    Write-Host "📊 Buscando logs para execution: $executionId" -ForegroundColor Yellow
    docker logs --tail 200 calendar-webhook-worker-1 2>&1 | Select-String $executionId -Context 10
}

