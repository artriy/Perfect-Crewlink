param(
	[string]$ProcessName = "perfectcrewlink",
	[string]$LaunchPath = "",
	[int]$WarmupSeconds = 5,
	[int]$DurationSeconds = 60,
	[int]$IntervalMs = 1000,
	[string]$ScenarioName = "manual",
	[string]$OutputPath = "",
	[switch]$StopAfter
)

$ErrorActionPreference = "Stop"

$launchedProcess = $null
if ($LaunchPath) {
	$launchedProcess = Start-Process -FilePath $LaunchPath -PassThru
	Start-Sleep -Seconds $WarmupSeconds
}

function Sum-ProcessProperty($processes, [string]$property) {
	$sum = ($processes | Measure-Object -Property $property -Sum).Sum
	if ($null -eq $sum) { return 0 }
	return [double]$sum
}

function Convert-CimDate($value) {
	if ($value -is [DateTime]) { return $value }
	return [Management.ManagementDateTimeConverter]::ToDateTime($value)
}

function Get-DescendantProcessIds([int[]]$rootIds, [DateTime]$oldestRootStart) {
	$minCreationTime = $oldestRootStart.AddSeconds(-5)
	$all = @(
		Get-CimInstance Win32_Process |
			Where-Object { (Convert-CimDate $_.CreationDate) -ge $minCreationTime } |
			Select-Object ProcessId, ParentProcessId, Name, CreationDate
	)
	$ids = New-Object 'System.Collections.Generic.HashSet[int]'
	$queue = New-Object 'System.Collections.Generic.Queue[int]'

	foreach ($rootId in $rootIds) {
		if ($ids.Add($rootId)) {
			$queue.Enqueue($rootId)
		}
	}

	while ($queue.Count -gt 0) {
		$parentId = $queue.Dequeue()
		foreach ($child in $all | Where-Object { $_.ParentProcessId -eq $parentId }) {
			$childId = [int]$child.ProcessId
			if ($ids.Add($childId)) {
				$queue.Enqueue($childId)
			}
		}
	}

	return @($ids)
}

function Get-RootProcesses {
	if ($null -ne $launchedProcess) {
		$launched = Get-Process -Id $launchedProcess.Id -ErrorAction SilentlyContinue
		if ($null -ne $launched) {
			return @($launched)
		}
	}

	return @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
}

function New-Snapshot {
	$roots = @(Get-RootProcesses)
	$rootIds = @($roots | ForEach-Object { [int]$_.Id })
	if ($rootIds.Count -eq 0) {
		return [PSCustomObject]@{
			Timestamp = Get-Date
			RootPids = @()
			ProcessCount = 0
			WebView2Count = 0
			TotalWorkingSetMB = 0
			TotalPrivateMB = 0
			WebView2WorkingSetMB = 0
			WebView2PrivateMB = 0
			TotalCpuSeconds = 0
			Processes = @()
		}
	}

	$oldestRootStart = ($roots | ForEach-Object { $_.StartTime } | Sort-Object | Select-Object -First 1)
	if ($null -eq $oldestRootStart) {
		$oldestRootStart = Get-Date
	}
	$treeIds = @(Get-DescendantProcessIds $rootIds $oldestRootStart)
	$processes = @($treeIds | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
	$webviews = @($processes | Where-Object { $_.ProcessName -ieq "msedgewebview2" })

	$processRows = @($processes | Sort-Object ProcessName, Id | ForEach-Object {
		[PSCustomObject]@{
			Pid = $_.Id
			Name = $_.ProcessName
			WorkingSetMB = [Math]::Round($_.WorkingSet64 / 1MB, 2)
			PrivateMB = [Math]::Round($_.PrivateMemorySize64 / 1MB, 2)
			CpuSeconds = [Math]::Round([double]$_.CPU, 3)
		}
	})

	return [PSCustomObject]@{
		Timestamp = Get-Date
		RootPids = $rootIds
		ProcessCount = $processes.Count
		WebView2Count = $webviews.Count
		TotalWorkingSetMB = [Math]::Round((Sum-ProcessProperty $processes "WorkingSet64") / 1MB, 2)
		TotalPrivateMB = [Math]::Round((Sum-ProcessProperty $processes "PrivateMemorySize64") / 1MB, 2)
		WebView2WorkingSetMB = [Math]::Round((Sum-ProcessProperty $webviews "WorkingSet64") / 1MB, 2)
		WebView2PrivateMB = [Math]::Round((Sum-ProcessProperty $webviews "PrivateMemorySize64") / 1MB, 2)
		TotalCpuSeconds = [Math]::Round((Sum-ProcessProperty $processes "CPU"), 3)
		Processes = $processRows
	}
}

$start = New-Snapshot
$samples = @()
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
while ($stopwatch.Elapsed.TotalSeconds -lt $DurationSeconds) {
	Start-Sleep -Milliseconds $IntervalMs
	$samples += New-Snapshot
}
$stopwatch.Stop()

if ($samples.Count -gt 0) {
	$end = $samples[$samples.Count - 1]
} else {
	$end = New-Snapshot
}

$duration = [Math]::Max(0.001, ($end.Timestamp - $start.Timestamp).TotalSeconds)
$logicalProcessors = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$cpuPercent = 0
if ($logicalProcessors -gt 0) {
	$cpuPercent = (($end.TotalCpuSeconds - $start.TotalCpuSeconds) / $duration / $logicalProcessors) * 100
}

$result = [PSCustomObject]@{
	Scenario = $ScenarioName
	ProcessName = $ProcessName
	LaunchPath = $LaunchPath
	DurationSeconds = [Math]::Round($duration, 2)
	LogicalProcessors = $logicalProcessors
	Start = $start
	End = $end
	AverageCpuPercent = [Math]::Round($cpuPercent, 3)
	Samples = $samples
}

if (-not $OutputPath) {
	$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
	$outputDir = Join-Path (Get-Location) "perf-results"
	$OutputPath = Join-Path $outputDir "webview2-$ScenarioName-$timestamp.json"
}

$outputParent = Split-Path -Parent $OutputPath
if ($outputParent) {
	New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "RESULT $OutputPath"
Write-Host "METRIC total_private_mb=$($end.TotalPrivateMB)"
Write-Host "METRIC total_working_set_mb=$($end.TotalWorkingSetMB)"
Write-Host "METRIC webview2_private_mb=$($end.WebView2PrivateMB)"
Write-Host "METRIC webview2_working_set_mb=$($end.WebView2WorkingSetMB)"
Write-Host "METRIC webview2_processes=$($end.WebView2Count)"
Write-Host "METRIC avg_cpu_percent=$([Math]::Round($cpuPercent, 3))"

if ($StopAfter -and $null -ne $launchedProcess) {
	Stop-Process -Id $launchedProcess.Id -Force -ErrorAction SilentlyContinue
}
