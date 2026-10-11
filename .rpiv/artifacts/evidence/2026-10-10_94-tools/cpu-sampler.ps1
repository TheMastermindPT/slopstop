# #94 per-process CPU sampler: every $IntervalSeconds, the top $Top processes by CPU delta.
# Writes CSV rows: utc, pid, name, cpuPct (of all logical cores), command line (first 200 chars).
# A "sampler-self" row per sample records this script's own cumulative CPU seconds and the
# sample's wall cost in ms. Stops when $StopFile exists.
param(
  [Parameter(Mandatory = $true)][string]$OutFile,
  [Parameter(Mandatory = $true)][string]$StopFile,
  [int]$IntervalSeconds = 2,
  [int]$Top = 10
)
$cores = [Environment]::ProcessorCount
$self = [System.Diagnostics.Process]::GetCurrentProcess()
$commandLines = @{}
"utc,pid,name,cpuPct,detail" | Out-File -FilePath $OutFile -Encoding utf8
$previous = @{}
foreach ($p in Get-Process) { try { $previous[$p.Id] = $p.TotalProcessorTime.TotalSeconds } catch {} }
$lastTick = [DateTime]::UtcNow
while (-not (Test-Path $StopFile)) {
  Start-Sleep -Seconds $IntervalSeconds
  $sampleStart = [DateTime]::UtcNow
  $elapsed = ($sampleStart - $lastTick).TotalSeconds
  $lastTick = $sampleStart
  $current = @{}
  $rows = foreach ($p in Get-Process) {
    try {
      $cpu = $p.TotalProcessorTime.TotalSeconds
      $current[$p.Id] = $cpu
      $before = $previous[$p.Id]
      if ($null -ne $before) {
        [pscustomobject]@{ Id = $p.Id; Name = $p.ProcessName; Pct = 100 * ($cpu - $before) / ($elapsed * $cores) }
      }
    } catch {}
  }
  $previous = $current
  $utc = $sampleStart.ToString("o")
  $topRows = $rows | Sort-Object Pct -Descending | Select-Object -First $Top
  # One batched CIM query, only when a top process has no known command line yet.
  if (@($topRows | Where-Object { -not $commandLines.ContainsKey($_.Id) }).Count -gt 0) {
    foreach ($cim in Get-CimInstance Win32_Process -Property ProcessId, CommandLine) {
      $line = if ($cim.CommandLine) { $cim.CommandLine } else { "" }
      $commandLines[[int]$cim.ProcessId] = ($line.Substring(0, [Math]::Min(200, $line.Length))) -replace '"', "'"
    }
  }
  $lines = foreach ($r in $topRows) {
    "$utc,$($r.Id),$($r.Name),$([Math]::Round($r.Pct, 1)),""$($commandLines[$r.Id])"""
  }
  $self.Refresh()
  $cost = ([DateTime]::UtcNow - $sampleStart).TotalMilliseconds
  $lines += "$utc,$PID,sampler-self,$([Math]::Round($self.TotalProcessorTime.TotalSeconds, 2)),""cumulative CPU s; sample wall ms $([Math]::Round($cost))"""
  $lines | Out-File -FilePath $OutFile -Append -Encoding utf8
}
