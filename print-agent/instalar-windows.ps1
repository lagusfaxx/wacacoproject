# Deja el agente de impresion corriendo solo cada vez que inicias sesion en Windows.
#
#   Clic derecho > "Ejecutar con PowerShell", o en una ventana de PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\instalar-windows.ps1
#
# Para quitarlo:  Unregister-ScheduledTask -TaskName "Agente de impresion" -Confirm:$false

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here 'agente.mjs'
$config = Join-Path $here 'config.json'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'No encuentro Node.js. Instalalo desde https://nodejs.org (version LTS) y vuelve a ejecutar esto.' }
if (-not (Test-Path $config)) { throw "Falta $config. Copia config.example.json a config.json y completalo." }

Write-Host 'Probando la conexion con las tiendas...'
& $node $script --probar

# Corre como tu usuario, al iniciar sesion, sin ventana, y se reinicia si se cae.
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$node' '$script'`"" `
  -WorkingDirectory $here
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'Agente de impresion' -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Imprime las etiquetas de Mercado Libre y los packing slips de TAUPOC que manda Claude.' -Force | Out-Null
Start-ScheduledTask -TaskName 'Agente de impresion'

Write-Host ''
Write-Host 'Listo: el agente quedo corriendo y arrancara solo cada vez que inicies sesion.'
Write-Host "Registro: $(Join-Path $here 'agente.log')"
