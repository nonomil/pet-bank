param(
    [string]$AssetId = "",
    [string]$Quality = "medium",
    [string]$KeyFile = "",
    [switch]$Force,
    [switch]$SkipGate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifestPath = Join-Path $repoRoot "assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/manifest.json"
$visualRoot = Split-Path $manifestPath -Parent
$promptRoot = Join-Path $visualRoot "prompts"
$rawRoot = Join-Path $repoRoot "tmp/minecraft-vocab-visual-raw"
$generator = Join-Path $repoRoot "scripts/token24-image-generate.py"

if (!(Test-Path -LiteralPath $manifestPath)) { throw "Missing manifest: $manifestPath" }
if (!(Test-Path -LiteralPath $generator)) { throw "Missing generator: $generator" }

$keyArgs = @()
if ($KeyFile) {
    $keyPath = Join-Path $repoRoot $KeyFile
    if (!(Test-Path -LiteralPath $keyPath)) { throw "Missing key file: $keyPath" }
    $keyArgs = @("--key-file", $keyPath)
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$assets = @($manifest.assets)
if ($AssetId) {
    $assets = @($assets | Where-Object { $_.id -eq $AssetId })
    if ($assets.Count -eq 0) { throw "Asset not found in manifest: $AssetId" }
}

New-Item -ItemType Directory -Force -Path $rawRoot | Out-Null

function Invoke-CheckedNative {
    $exe = $args[0]
    $rest = @($args | Select-Object -Skip 1)
    & $exe @rest
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $($args -join ' ')"
    }
}

$postprocessCode = @'
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
target_w = int(sys.argv[3])
target_h = int(sys.argv[4])

with Image.open(src) as image:
    image = image.convert('RGB')
    width, height = image.size
    source_ratio = width / height
    target_ratio = target_w / target_h
    if source_ratio > target_ratio:
        new_w = int(height * target_ratio)
        left = (width - new_w) // 2
        image = image.crop((left, 0, left + new_w, height))
    elif source_ratio < target_ratio:
        new_h = int(width / target_ratio)
        top = max(0, (height - new_h) // 2)
        image = image.crop((0, top, width, top + new_h))
    if image.size != (target_w, target_h):
        image = image.resize((target_w, target_h), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst, 'PNG', optimize=True)
'@

foreach ($asset in $assets) {
    $id = [string]$asset.id
    $promptPath = Join-Path $promptRoot "$id.txt"
    if (!(Test-Path -LiteralPath $promptPath)) { throw "Missing prompt for ${id}: $promptPath" }

    $targetPath = Join-Path $repoRoot ([string]$asset.path)
    $targetWidth = [int]$asset.dimensions[0]
    $targetHeight = [int]$asset.dimensions[1]
    $generationSize = if ($targetWidth -eq 1024 -and $targetHeight -eq 1024) {
        "1024x1024"
    } elseif ($targetHeight -gt $targetWidth) {
        "1024x1536"
    } else {
        "1536x1024"
    }
    $rawPath = Join-Path $rawRoot "$id.raw.png"

    if ($Force -or !(Test-Path -LiteralPath $rawPath)) {
        Write-Host "Generating $id via TokenX24 gpt-image-2 ($generationSize -> ${targetWidth}x${targetHeight})"
        Invoke-CheckedNative python $generator @keyArgs --prompt-file $promptPath --out $rawPath --size $generationSize --quality $Quality
    } else {
        Write-Host "Reusing raw image for ${id}: $rawPath"
    }
    Invoke-CheckedNative python -c $postprocessCode $rawPath $targetPath $targetWidth $targetHeight
    Write-Host "Published $targetPath"
}

if (!$SkipGate) {
    Invoke-CheckedNative node scripts/test-minecraft-vocab-visual-assets.mjs
}
