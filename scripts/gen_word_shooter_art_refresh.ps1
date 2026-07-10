param(
  [ValidateSet("home-card", "background", "asset-sheet")]
  [string]$Target = "home-card"
)

$ErrorActionPreference = "Stop"

$rootResolved = Split-Path -Parent $PSScriptRoot
$promptDir = Get-ChildItem -LiteralPath (Join-Path $rootResolved "prj") -Directory -Recurse |
  Where-Object { $_.Name -eq "word-shooter-art-refresh-2026-07-10" } |
  Select-Object -First 1

if (-not $promptDir) {
  throw "Cannot locate word-shooter-art-refresh-2026-07-10 under $rootResolved\prj"
}

$promptDirRelative = Resolve-Path -LiteralPath $promptDir.FullName -Relative
$promptDirRelative = $promptDirRelative -replace '^[.][\\/]?', ''
$outRootRelative = Join-Path $promptDirRelative "runs"
$promptDir = Join-Path $rootResolved $promptDirRelative
$outRoot = Join-Path $rootResolved $outRootRelative
$scriptRelative = ".\.codex\skills\gpt-image-bee-workflow\scripts\bee_image_workflow.py"

$map = @{
  "home-card" = @{
    Mode = "generate"
    Prompt = "01-home-card-prompt.txt"
    Prefix = "word-shooter-home-card-bright"
    Size = "1536x1024"
  }
  "background" = @{
    Mode = "generate"
    Prompt = "02-background-prompt.txt"
    Prefix = "word-shooter-background-bright"
    Size = "1536x1024"
  }
  "asset-sheet" = @{
    Mode = "asset-sheet"
    Prompt = "03-asset-sheet-prompt.txt"
    Prefix = "word-shooter-assets-bright"
    Size = "1024x1024"
  }
}

$job = $map[$Target]
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDirRelative = Join-Path $outRootRelative "$timestamp-$Target"
$promptFileRelative = Join-Path $promptDirRelative $job.Prompt
$outDir = Join-Path $rootResolved $outDirRelative
$promptFile = Join-Path $rootResolved $promptFileRelative

Write-Host "Generating $Target ..."
Write-Host "Prompt: $promptFile"
Write-Host "Out: $outDir"

$pyArgs = @(
  "-X", "utf8",
  $scriptRelative,
  $job.Mode,
  "--prompt-file", $promptFileRelative,
  "--out", $outDirRelative,
  "--prefix", $job.Prefix,
  "--size", $job.Size
)

if ($Target -eq "asset-sheet") {
  $pyArgs += "--remove-green"
  $pyArgs += "--split"
}

Push-Location $rootResolved
try {
  python @pyArgs
} finally {
  Pop-Location
}
