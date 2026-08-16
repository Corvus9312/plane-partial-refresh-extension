# Builds a distributable .zip of this extension for "load unpacked" testing
# and for uploading to AMO / Chrome Web Store dev dashboard.
#
# Usage:
#   powershell -File .\package.ps1
#
# Output: web-ext-artifacts\<folder-name>-<version>.zip
# Reads the version from manifest.json so the output filename always matches.
#
# Note: this uses System.IO.Compression directly (not Compress-Archive) so zip
# entries always use "/" as the path separator. Compress-Archive on Windows
# writes "\" in entry names for subfolders, which AMO's validator rejects
# ("Invalid file name in archive").

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = $PSScriptRoot
$manifestPath = Join-Path $repoRoot "manifest.json"
$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
$manifest = $manifestText | ConvertFrom-Json
$version = $manifest.version
$folderName = Split-Path $repoRoot -Leaf

$outDir = Join-Path $repoRoot "web-ext-artifacts"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$zipPath = Join-Path $outDir "$folderName-$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Anything under these top-level dirs, or matching these filenames/extensions,
# is dev tooling / build output and should not ship in the extension zip.
$excludeDirs = @(".git", "node_modules", "web-ext-artifacts")
$excludeFiles = @(".gitignore", "package.json", "package-lock.json", "package.ps1")
$excludeExtensions = @(".zip")

$files = Get-ChildItem -Path $repoRoot -Recurse -File -Force | Where-Object {
    $relative = $_.FullName.Substring($repoRoot.Length + 1)
    $topLevel = ($relative -split '[\\/]')[0]
    ($excludeDirs -notcontains $topLevel) `
        -and ($excludeFiles -notcontains $_.Name) `
        -and ($excludeExtensions -notcontains $_.Extension)
}

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $entryName = ($file.FullName.Substring($repoRoot.Length + 1)) -replace '\\', '/'
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zip.Dispose()
}

Write-Host "Built: $zipPath"
