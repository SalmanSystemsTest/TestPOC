# Builds ssg-autoparts-GitHub-UI-upload.zip for drag-drop upload on GitHub.
$ErrorActionPreference = "Stop"
$src = Split-Path $PSScriptRoot -Parent
$parent = Split-Path $src -Parent
$outName = "ssg-autoparts-GitHub-UI-upload"
$staging = Join-Path $parent $outName
$zipPath = Join-Path $parent "$outName.zip"

if (-not (Test-Path (Join-Path $src "package.json"))) {
  throw "Expected package.json in $src"
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

New-Item -ItemType Directory -Path $staging | Out-Null

$excludeDirs = @(
  "node_modules", ".expo", "dist", "web-build", ".git", $outName
)

robocopy $src $staging /E `
  /XD $excludeDirs "supabase\.temp" `
  /XF "Pass.txt" ".env.local" /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Copy-Item (Join-Path $src "docs\GITHUB-UI-UPLOAD.md") (Join-Path $staging "GITHUB-UI-UPLOAD-README.md") -Force

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

Write-Host "Created:"
Write-Host "  Folder: $staging"
Write-Host "  Zip:    $zipPath"
Write-Host "Unzip (if needed), then upload everything inside the folder via GitHub -> Add file -> Upload files."
