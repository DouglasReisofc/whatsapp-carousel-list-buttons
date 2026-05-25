param(
  [string]$Clicker = "100.127.222.24:5555",
  [string]$Observer = "192.168.0.105:5555",
  [string]$Prefix = "adb-latest-list",
  [string]$ButtonText = "ABRIR LISTA",
  [int]$BottomSwipes = 0,
  [int]$OpenDelayMs = 650,
  [int]$PostClickDelaySeconds = 2,
  [switch]$JumpToBottom
)

$ErrorActionPreference = "Stop"

function Tap-CenterFromBounds {
  param([System.Text.RegularExpressions.Match]$Match)

  $x = [int](([int]$Match.Groups[1].Value + [int]$Match.Groups[3].Value) / 2)
  $y = [int](([int]$Match.Groups[2].Value + [int]$Match.Groups[4].Value) / 2)
  adb -s $Clicker shell input tap $x $y
  "$x,$y"
}

if ($BottomSwipes -gt 0) {
  for ($i = 0; $i -lt $BottomSwipes; $i++) {
    adb -s $Clicker shell input swipe 500 1900 500 300 250
    Start-Sleep -Milliseconds 180
  }
}

if ($JumpToBottom) {
  adb -s $Clicker shell input tap 1005 2075
  Start-Sleep -Milliseconds 450
}

adb -s $Clicker shell uiautomator dump /sdcard/window.xml > $null
$xml = adb -s $Clicker exec-out cat /sdcard/window.xml
$buttonPattern = [regex]::Escape($ButtonText)
$listButtons = [regex]::Matches($xml, "(?:content-desc|text)=`"$buttonPattern`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"")

if ($listButtons.Count -eq 0) {
  throw "$ButtonText nao encontrado no aparelho clicker"
}

$openTap = Tap-CenterFromBounds $listButtons[$listButtons.Count - 1]
Write-Host "$ButtonText -> $openTap"
Start-Sleep -Milliseconds $OpenDelayMs

adb -s $Clicker shell uiautomator dump /sdcard/window.xml > $null
$sheet = adb -s $Clicker exec-out cat /sdcard/window.xml
$selectButtons = [regex]::Matches($sheet, 'text=\"Selecionar\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"')

if ($selectButtons.Count -gt 0) {
  $selectTap = Tap-CenterFromBounds $selectButtons[$selectButtons.Count - 1]
  Write-Host "Selecionar -> $selectTap"
} elseif ($sheet -match "Selecionar") {
  adb -s $Clicker shell input tap 540 2160
  Write-Host "Selecionar -> 540,2160"
} elseif ($sheet -match "opcao A") {
  $rowButtons = [regex]::Matches($sheet, 'text=\"[^\"]*opcao A[^\"]*\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"')
  if ($rowButtons.Count -eq 0) {
    throw "A lista abriu, mas nao encontrei a primeira linha"
  }
  $rowTap = Tap-CenterFromBounds $rowButtons[$rowButtons.Count - 1]
  Write-Host "Linha A -> $rowTap"
} else {
  throw "A lista abriu, mas o botao Selecionar nao apareceu"
}

Start-Sleep -Seconds $PostClickDelaySeconds
cmd /c "adb -s $Clicker exec-out screencap -p > `"$Prefix-100.png`""
cmd /c "adb -s $Observer exec-out screencap -p > `"$Prefix-192.png`""
Write-Host "prints -> $Prefix-100.png / $Prefix-192.png"
