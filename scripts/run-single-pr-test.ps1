param(
  [int]$Case,
  [string]$Tag = "",
  [string]$Jid = "120363406245712972@g.us",
  [string]$ButtonPrefix = "BTN",
  [int]$DelayMs = 7000,
  [int]$WatchMs = 55000,
  [int]$StartClickDelaySeconds = 8,
  [int]$BottomSwipes = 0,
  [int]$OpenDelayMs = 650,
  [int]$PostClickDelaySeconds = 2,
  [string]$FlowName = "",
  [string]$NodeMode = "",
  [switch]$JumpToBottom
)

$ErrorActionPreference = "Continue"

if (-not $Tag) {
  $Tag = "PR$Case"
}

$button = "$ButtonPrefix`_$Tag"
$dump = "$Tag-dump.jsonl"
$log = "$Tag.log"
$err = "$Tag.err.log"
$prefix = "adb-$Tag-after-select"

Remove-Item -LiteralPath $dump,$log,$err,"$prefix-100.png","$prefix-192.png" -ErrorAction SilentlyContinue

function Save-Screens {
  param([string]$OutPrefix)
  try {
    cmd /c "adb -s 100.127.222.24:5555 exec-out screencap -p > `"$OutPrefix-100.png`""
    cmd /c "adb -s 192.168.0.105:5555 exec-out screencap -p > `"$OutPrefix-192.png`""
  } catch {
    Write-Host "SCREENSHOT_FAIL $($_.Exception.Message)"
  }
}

$prevFlowName = $env:BAILEYS_INTERACTIVE_FLOW_NAME
$prevNodeMode = $env:BAILEYS_INTERACTIVE_NODE_MODE

if ($FlowName) {
  $env:BAILEYS_INTERACTIVE_FLOW_NAME = $FlowName
} else {
  Remove-Item Env:BAILEYS_INTERACTIVE_FLOW_NAME -ErrorAction SilentlyContinue
}

if ($NodeMode) {
  $env:BAILEYS_INTERACTIVE_NODE_MODE = $NodeMode
} else {
  Remove-Item Env:BAILEYS_INTERACTIVE_NODE_MODE -ErrorAction SilentlyContinue
}

$p = Start-Process -FilePath node -ArgumentList @(
  'scripts/send-proto-response-battery.js',
  $Jid,
  './session',
  './assets/thumb.jpg',
  "$Case",
  "$Case",
  "$DelayMs",
  "--watch=$WatchMs",
  "--dump=$dump",
  "--button=$button"
) -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru

if ($null -ne $prevFlowName) {
  $env:BAILEYS_INTERACTIVE_FLOW_NAME = $prevFlowName
} else {
  Remove-Item Env:BAILEYS_INTERACTIVE_FLOW_NAME -ErrorAction SilentlyContinue
}

if ($null -ne $prevNodeMode) {
  $env:BAILEYS_INTERACTIVE_NODE_MODE = $prevNodeMode
} else {
  Remove-Item Env:BAILEYS_INTERACTIVE_NODE_MODE -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds $StartClickDelaySeconds

try {
  $adbArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', '.\scripts\adb-select-latest-list.ps1',
    '-Prefix', $prefix,
    '-ButtonText', $button,
    '-BottomSwipes', "$BottomSwipes",
    '-OpenDelayMs', "$OpenDelayMs",
    '-PostClickDelaySeconds', "$PostClickDelaySeconds"
  )
  if ($JumpToBottom) {
    $adbArgs += '-JumpToBottom'
  }
  & powershell @adbArgs
} catch {
  Write-Host "ADB_FAIL $($_.Exception.Message)"
}

Save-Screens -OutPrefix $prefix

$p.WaitForExit([Math]::Max($WatchMs + 20000, 70000)) | Out-Null

Write-Host "NODE_EXIT $($p.HasExited) $($p.ExitCode)"
Write-Host "FLOW_NAME $FlowName NODE_MODE $NodeMode"
Write-Host "--- log ---"
Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 12
Write-Host "--- err ---"
Get-Content $err -ErrorAction SilentlyContinue | Select-Object -Last 6
Write-Host "--- dump ---"
if (Test-Path $dump) {
  Get-Content $dump | Select-Object -Last 2
} else {
  Write-Host "sem dump"
}

try {
  adb -s 192.168.0.105:5555 shell uiautomator dump /sdcard/window.xml > $null
  $xml = adb -s 192.168.0.105:5555 exec-out cat /sdcard/window.xml
  $bad = [regex]::Matches($xml, [regex]::Escape("não é compatível")).Count
  $update = [regex]::Matches($xml, [regex]::Escape("Atualizar o WhatsApp")).Count
  $tagHits = [regex]::Matches($xml, [regex]::Escape("PR-$Case")).Count + [regex]::Matches($xml, [regex]::Escape("PR$Case")).Count
  Write-Host "--- observer ---"
  Write-Host "incompativel=$bad atualizar=$update tagHits=$tagHits"
} catch {
  Write-Host "OBSERVER_XML_FAIL $($_.Exception.Message)"
}
