$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$key = (Get-Content $envFile | Where-Object { $_ -match "^ELEVENLABS_API_KEY=" }) -replace "^ELEVENLABS_API_KEY=", ""

$scriptJson = Join-Path $root "voiceover-script.json"
$audioDir = Join-Path $root "public\audio"
$manifestPath = Join-Path $audioDir "manifest.json"

$voiceId = "onwK4e9ZLuTAKqWW03F9" # Daniel - Steady Broadcaster
$lines = Get-Content $scriptJson -Raw | ConvertFrom-Json
$shell = New-Object -ComObject Shell.Application
$manifest = @()

foreach ($line in $lines) {
    $mp3Path = Join-Path $audioDir ($line.id + ".mp3")
    $body = @{
        text = $line.text
        model_id = "eleven_multilingual_v2"
        voice_settings = @{ stability = 0.5; similarity_boost = 0.75; style = 0.2; use_speaker_boost = $true }
    } | ConvertTo-Json

    Invoke-RestMethod -Uri "https://api.elevenlabs.io/v1/text-to-speech/$voiceId" `
        -Method Post `
        -Headers @{ "xi-api-key" = $key; "Content-Type" = "application/json" } `
        -Body $body `
        -OutFile $mp3Path

    $folder = $shell.Namespace((Split-Path $mp3Path))
    $file = $folder.ParseName((Split-Path $mp3Path -Leaf))
    $durStr = $folder.GetDetailsOf($file, 27)
    $parts = $durStr.Split(":")
    $seconds = 0
    if ($parts.Length -eq 3) {
        $seconds = ([int]$parts[0]) * 3600 + ([int]$parts[1]) * 60 + [double]$parts[2]
    }

    $manifest += [PSCustomObject]@{ id = $line.id; text = $line.text; seconds = [math]::Round($seconds, 2) }
    Write-Output "$($line.id): $([math]::Round($seconds,2))s"
}

$manifest | ConvertTo-Json | Out-File -Encoding UTF8 $manifestPath
Write-Output "DONE"
