param(
    [Parameter(Mandatory = $true)]
    [string]$SessionName,

    [Parameter(Mandatory = $true)]
    [string]$OutDir,

    [string]$NamePrefix = "chatgpt-estuary",

    [int]$SelectIndex = -1,

    [string]$SelectedName = "selected"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Invoke-BrowserEvalStdin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Script
    )

    $Script | browser-act --session $SessionName eval --stdin
}

function Invoke-BrowserEval {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Script
    )

    browser-act --session $SessionName eval $Script
}

function Invoke-BrowserText {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & browser-act @Arguments
}

function Get-ImageExtension {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MimeType
    )

    switch -Regex ($MimeType.ToLowerInvariant()) {
        "image/png" { return "png" }
        "image/webp" { return "webp" }
        "image/jpeg" { return "jpg" }
        "image/jpg" { return "jpg" }
        default { return "bin" }
    }
}

$rawDir = Join-Path $OutDir "downloads\\raw"
$selectedDir = Join-Path $OutDir "downloads\\selected"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
New-Item -ItemType Directory -Force -Path $selectedDir | Out-Null

$metaScript = @'
(async()=>{
  const seen = new Map();
  for (const img of [...document.querySelectorAll("img")]) {
    if (!img.src.includes("estuary/content")) continue;
    if (!seen.has(img.src)) {
      seen.set(img.src, {
        src: img.src,
        altEncoded: encodeURIComponent((img.alt || "").replace(/[\uD800-\uDFFF]/g, "")),
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0
      });
    }
  }
  const out = [];
  for (const item of seen.values()) {
    try {
      const r = await fetch(item.src);
      out.push({
        ...item,
        contentType: r.headers.get("content-type") || "application/octet-stream"
      });
    } catch (e) {
      out.push({
        ...item,
        contentType: "application/octet-stream",
        fetchError: e.message || String(e)
      });
    }
  }
  return JSON.stringify(out);
})()
'@

$metaJson = (Invoke-BrowserEvalStdin -Script $metaScript).Trim()
if ([string]::IsNullOrWhiteSpace($metaJson)) {
    throw "No estuary metadata returned from the current page."
}

$items = $metaJson | ConvertFrom-Json
if ($items -isnot [System.Array]) {
    $items = @($items)
}
if ($items.Count -eq 0) {
    throw "No estuary images found on the current page."
}

# Force each estuary URL through fetch() so browser-act records a Fetch request
# whose response body can be exported directly as base64.
$prefetchJson = ($items | Select-Object src | ConvertTo-Json -Compress)
$prefetchScript = @"
(async()=>{
  const urls = $prefetchJson;
  const out = [];
  for (const item of urls) {
    const r = await fetch(item.src);
    const b = await r.blob();
    out.push({ src: item.src, ok: r.ok, status: r.status, size: b.size, type: b.type || "" });
  }
  return JSON.stringify(out);
})()
"@

[void](Invoke-BrowserEvalStdin -Script $prefetchScript)

$networkCsv = Invoke-BrowserText -Arguments @("--session", $SessionName, "network", "requests", "--filter", "estuary", "--type", "fetch")
$networkLines = $networkCsv -split "`r?`n" | Where-Object { $_ -and -not $_.StartsWith("#") }
if ($networkLines.Count -lt 2) {
    throw "No estuary fetch requests found in browser-act network log."
}

$requestRows = $networkLines | ConvertFrom-Csv

$manifest = @()
for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $src = [string]$item.src
    $row = $requestRows | Where-Object { $_.url -eq $src } | Select-Object -Last 1
    if (-not $row) {
        throw "No browser-act network request matched estuary image $i."
    }

    $details = Invoke-BrowserText -Arguments @("--session", $SessionName, "network", "request", $row.request_id)
    $bodyLine = ($details -split "`r?`n" | Where-Object { $_.StartsWith("response_body=") } | Select-Object -First 1)
    if (-not $bodyLine) {
        throw "No response_body found for estuary image $i."
    }

    $base64Body = $bodyLine.Substring("response_body=".Length)
    $mimeType = if ($row.mime_type) { [string]$row.mime_type } else { [string]$item.contentType }
    $extension = Get-ImageExtension -MimeType $mimeType
    $baseName = "{0}-{1:d2}" -f $NamePrefix, ($i + 1)
    $rawPath = Join-Path $rawDir ($baseName + "." + $extension)
    [System.IO.File]::WriteAllBytes($rawPath, [Convert]::FromBase64String($base64Body))

    $record = [ordered]@{
        index = $i
        file = $rawPath
        fileName = [System.IO.Path]::GetFileName($rawPath)
        alt = [System.Uri]::UnescapeDataString([string]$item.altEncoded)
        src = $src
        width = [int]$item.width
        height = [int]$item.height
        contentType = [string]$item.contentType
        bytes = (Get-Item -LiteralPath $rawPath).Length
    }
    $manifest += [pscustomobject]$record

    if ($SelectIndex -eq $i) {
        $selectedPath = Join-Path $selectedDir ($SelectedName + "." + $extension)
        Copy-Item -LiteralPath $rawPath -Destination $selectedPath -Force
    }
}

$manifestPath = Join-Path $OutDir "downloads\\manifest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

$manifest | Format-Table -AutoSize
Write-Host "MANIFEST $manifestPath"
