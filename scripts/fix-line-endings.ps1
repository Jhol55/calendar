# Script para converter CRLF para LF no judge0.conf
Write-Host "Convertendo line endings do judge0.conf..." -ForegroundColor Cyan

$file = "judge0.conf"
$content = Get-Content $file -Raw

# Substituir CRLF por LF
$contentLF = $content -replace "`r`n", "`n"

# Salvar sem BOM
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllText("$PWD\$file", $contentLF, $Utf8NoBomEncoding)

Write-Host "Arquivo corrigido!" -ForegroundColor Green
Write-Host ""
Write-Host "Verificando..." -ForegroundColor Yellow

# Verificar
$bytes = [System.IO.File]::ReadAllBytes("$PWD\$file")
$hasCRLF = $false
for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
    if ($bytes[$i] -eq 13 -and $bytes[$i+1] -eq 10) {
        $hasCRLF = $true
        break
    }
}

if ($hasCRLF) {
    Write-Host "Ainda tem CRLF" -ForegroundColor Red
} else {
    Write-Host "Todos os line endings sao LF" -ForegroundColor Green
}

