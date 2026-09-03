<#
.SYNOPSIS
  Roda a comparação de desempenho entre Sistema A, B e C: sobe cada sistema via
  Docker Compose, executa os 3 perfis de carga do TCC (100/500/1000 VUs) com
  k6, coleta CPU/RAM por container via `docker stats`, e derruba o stack antes
  de passar para o próximo sistema (execução sequencial, evita contenção de
  recursos entre sistemas distorcendo a comparação).

.EXAMPLE
  ./scripts/run-comparison.ps1
  ./scripts/run-comparison.ps1 -Sistemas a,c -Perfis 100
#>

param(
  [string[]]$Sistemas = @('a', 'b', 'c'),
  [string[]]$Perfis = @('100', '500', '1000'),
  [int]$PoolSize = 20
)

# Nota: NÃO usar $ErrorActionPreference = 'Stop' aqui — comandos nativos como
# `docker` escrevem seu output normal de progresso no stderr, e com essa
# preferência o Windows PowerShell 5.1 trata cada linha de stderr como uma
# exceção fatal mesmo quando o comando termina com sucesso (exit code 0). Em
# vez disso, cada chamada relevante verifica $LASTEXITCODE manualmente.
$ErrorActionPreference = 'Continue'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ResultsDir = Join-Path $RepoRoot 'results'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null
$K6ScriptDir = Join-Path $RepoRoot 'load-tests/k6'

$Config = @{
  a = @{
    Dir              = 'sistema-a-monolito'
    Network          = 'sistema-a_default'
    BaseUrl          = 'http://app:3000'
    HealthContainer  = 'sistema-a-app-1'
    StatsContainers  = @('sistema-a-app-1')
  }
  b = @{
    Dir              = 'sistema-b-microservicos'
    Network          = 'sistema-b_default'
    BaseUrl          = 'http://gateway:3000'
    HealthContainer  = 'sistema-b-gateway-1'
    StatsContainers  = @(
      'sistema-b-gateway-1', 'sistema-b-auth-service-1', 'sistema-b-pedidos-service-1',
      'sistema-b-faturamento-service-1', 'sistema-b-notificacoes-service-1'
    )
  }
  c = @{
    Dir              = 'sistema-c-modular-monolith'
    Network          = 'sistema-c_default'
    BaseUrl          = 'http://app:3000'
    HealthContainer  = 'sistema-c-app-1'
    StatsContainers  = @('sistema-c-app-1')
  }
}

function Wait-Healthy($container, $maxTries = 60) {
  for ($i = 0; $i -lt $maxTries; $i++) {
    $status = (docker inspect --format '{{.State.Health.Status}}' $container 2>$null)
    if ($status -eq 'healthy') { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

foreach ($sis in $Sistemas) {
  $cfg = $Config[$sis]
  $sisDir = Join-Path $RepoRoot $cfg.Dir

  Write-Host "`n=== Sistema $($sis.ToUpper()) — subindo stack ($($cfg.Dir)) ===" -ForegroundColor Cyan
  Push-Location $sisDir
  try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose up falhou (exit code $LASTEXITCODE) para o sistema $sis."
    }
    if (-not (Wait-Healthy $cfg.HealthContainer)) {
      throw "Container $($cfg.HealthContainer) não ficou healthy a tempo."
    }
    Write-Host "Sistema $sis pronto." -ForegroundColor Green

    foreach ($perfil in $Perfis) {
      Write-Host "`n--- Sistema $sis / perfil $perfil VUs ---" -ForegroundColor Yellow

      # Amostra CPU/RAM por container a cada 2s enquanto o k6 roda em segundo plano
      $statsFile = Join-Path $ResultsDir "$sis-$perfil-stats.csv"
      "timestamp,container,cpu_percent,mem_usage" | Out-File -FilePath $statsFile -Encoding utf8

      $samplerJob = Start-Job -ScriptBlock {
        param($containers, $file)
        while ($true) {
          $lines = docker stats $containers --no-stream --format "{{.Container}},{{.CPUPerc}},{{.MemUsage}}" 2>$null
          $ts = (Get-Date).ToString('o')
          foreach ($line in $lines) {
            "$ts,$line" | Out-File -FilePath $file -Append -Encoding utf8
          }
          Start-Sleep -Seconds 2
        }
      } -ArgumentList (, $cfg.StatsContainers), $statsFile

      $tmpSummary = Join-Path $K6ScriptDir '_summary_tmp.json'
      if (Test-Path $tmpSummary) { Remove-Item $tmpSummary -Force }

      $dockerArgs = @(
        'run', '--rm', '--network', $cfg.Network,
        '-v', "${K6ScriptDir}:/scripts",
        '-e', "BASE_URL=$($cfg.BaseUrl)",
        '-e', "PROFILE=$perfil",
        '-e', "POOL_SIZE=$PoolSize",
        'grafana/k6:latest', 'run', '--summary-export=/scripts/_summary_tmp.json', '/scripts/scenario.js'
      )
      & docker @dockerArgs
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "k6 terminou com exit code $LASTEXITCODE para sistema $sis / perfil $perfil (thresholds podem ter falhado; resultado ainda é salvo se o resumo existir)."
      }

      Stop-Job $samplerJob | Out-Null
      Remove-Job $samplerJob | Out-Null

      $summaryFile = Join-Path $ResultsDir "$sis-$perfil-k6-summary.json"
      if (Test-Path $tmpSummary) {
        Move-Item -Force $tmpSummary $summaryFile
        Write-Host "Resumo salvo em $summaryFile"
      } else {
        Write-Warning "k6 não gerou resumo para sistema $sis / perfil $perfil — verifique os logs acima."
      }
    }
  } finally {
    Write-Host "`nDerrubando stack do sistema $sis..." -ForegroundColor DarkGray
    docker compose down
    Pop-Location
  }
}

Write-Host "`nConcluído. Rode 'node scripts/generate-report.js' para consolidar os resultados em results/comparativo-local.md" -ForegroundColor Green
