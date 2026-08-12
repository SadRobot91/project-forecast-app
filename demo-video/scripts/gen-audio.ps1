Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$scriptJson = Join-Path $root "voiceover-script.json"
$audioDir = Join-Path $root "public\audio"
$manifestPath = Join-Path $root "public\audio\manifest.json"

$lines = Get-Content $scriptJson -Raw | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Elsa")
$synth.Rate = -2
$synth.Volume = 100

$shell = New-Object -ComObject Shell.Application

$manifest = @()

foreach ($line in $lines) {
    $wavPath = Join-Path $audioDir ($line.id + ".wav")
    $synth.SetOutputToWaveFile($wavPath)
    $synth.Speak($line.text)
    $synth.SetOutputToDefaultAudioDevice()

    $folder = $shell.Namespace((Split-Path $wavPath))
    $file = $folder.ParseName((Split-Path $wavPath -Leaf))
    $durStr = $folder.GetDetailsOf($file, 27) # System.Media.Duration, format H:MM:SS
    # durStr format like "0:00:03"
    $parts = $durStr.Split(":")
    $seconds = 0
    if ($parts.Length -eq 3) {
        $seconds = ([int]$parts[0]) * 3600 + ([int]$parts[1]) * 60 + [double]$parts[2]
    }

    $manifest += [PSCustomObject]@{
        id = $line.id
        text = $line.text
        seconds = [math]::Round($seconds, 2)
    }
    Write-Output "$($line.id): $([math]::Round($seconds,2))s"
}

$manifest | ConvertTo-Json | Out-File -Encoding UTF8 $manifestPath
Write-Output "Manifest written to $manifestPath"
