param(
  [Parameter(Mandatory = $false)]
  [ValidateRange(1, 20)]
  [int]$Keep = 1
)

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw "Unable to resolve the Git repository root." }

$backupRoot = Join-Path $repoRoot ".codex-backups"
$backupRootFull = [System.IO.Path]::GetFullPath($backupRoot)
[System.IO.Directory]::CreateDirectory($backupRootFull) | Out-Null

$relativeFiles = @(
  git -C $repoRoot -c core.quotepath=false ls-files --cached --others --exclude-standard |
    ForEach-Object { $_.Replace("\", "/") } |
    Where-Object {
      $_ -and
      -not $_.StartsWith(".codex-backups/") -and
      (Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf)
    } |
    Sort-Object -Unique
)

if ($LASTEXITCODE -ne 0) { throw "git ls-files failed with exit code $LASTEXITCODE" }
if ($relativeFiles.Count -eq 0) { throw "No repository files were found for the snapshot." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$finalPath = Join-Path $backupRootFull "snapshot-$stamp.zip"
$partialPath = "$finalPath.partial"

try {
  $archive = [System.IO.Compression.ZipFile]::Open($partialPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($relativePath in $relativeFiles) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        (Join-Path $repoRoot $relativePath),
        $relativePath,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $archive.Dispose()
  }

  $verificationArchive = [System.IO.Compression.ZipFile]::OpenRead($partialPath)
  try {
    $archiveEntries = @($verificationArchive.Entries | ForEach-Object { $_.FullName } | Sort-Object -Unique)
  } finally {
    $verificationArchive.Dispose()
  }

  $missing = @($relativeFiles | Where-Object { $_ -notin $archiveEntries })
  $unexpected = @($archiveEntries | Where-Object { $_ -notin $relativeFiles })
  if ($archiveEntries.Count -ne $relativeFiles.Count -or $missing.Count -gt 0 -or $unexpected.Count -gt 0) {
    throw "Snapshot verification failed: source=$($relativeFiles.Count), archive=$($archiveEntries.Count), missing=$($missing.Count), unexpected=$($unexpected.Count)."
  }

  foreach ($requiredPath in @("AGENTS.md", "package.json", "logs/execution_log.md", "logs/retrospective.md")) {
    if ($requiredPath -notin $archiveEntries) { throw "Snapshot verification failed: required entry '$requiredPath' is missing." }
  }

  Move-Item -LiteralPath $partialPath -Destination $finalPath

  $snapshots = @(Get-ChildItem -LiteralPath $backupRootFull -Filter "snapshot-*.zip" -File | Sort-Object LastWriteTimeUtc -Descending)
  foreach ($oldSnapshot in @($snapshots | Select-Object -Skip $Keep)) {
    $oldPath = [System.IO.Path]::GetFullPath($oldSnapshot.FullName)
    if ([System.IO.Path]::GetDirectoryName($oldPath) -ne $backupRootFull) {
      throw "Refusing to remove a snapshot outside '$backupRootFull'."
    }
    Remove-Item -LiteralPath $oldPath
  }

  Write-Host "Snapshot verified: $finalPath"
  Write-Host "Archived files: $($archiveEntries.Count); retained snapshots: $([Math]::Min($Keep, $snapshots.Count))"
} catch {
  if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath }
  throw
}
