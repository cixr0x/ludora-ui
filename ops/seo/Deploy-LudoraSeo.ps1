[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('InstallTools', 'Prepare', 'Stage', 'Finalize', 'Refresh', 'EnableTimer', 'Status', 'Rollback')][string]$Action,
    [ValidatePattern('^[a-f0-9]{40}$')][string]$UiSha,
    [ValidatePattern('^[a-f0-9]{40}$')][string]$ServiceSha,
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')][string]$DeploymentId,
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')][string]$StageId,
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')][string]$RunId,
    [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')][string]$GenerationId
)
$ErrorActionPreference = 'Stop'
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$launcher = '/usr/bin/node /var/lib/ludoradar-seo/bin/seo-launcher.mjs'
function Invoke-Remote([string]$Command) {
    & gcloud compute ssh ludora --project ludora-501213 --zone northamerica-south1-a --command $Command
    if ($LASTEXITCODE -ne 0) { throw "Remote operation failed with exit $LASTEXITCODE. Busy (75), superseded (76), and failed phases are not deployment success." }
}
function Require-Value([string]$Name, [string]$Value) {
    if (-not $Value) { throw "-$Name is required for $Action." }
}
switch ($Action) {
    'InstallTools' {
        Require-Value 'UiSha' $UiSha
        $actual = (& git -C $taskProjectRoot rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0 -or $actual -ne $UiSha) { throw 'Local tool source does not match the requested UI SHA.' }
        $dirty = & git -C $taskProjectRoot status --porcelain --untracked-files=no
        if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Commit tracked local tool changes before installation.' }
        $toolId = [guid]::NewGuid().ToString()
        $out = Join-Path $taskProjectRoot ".seo/deploy-tools/$toolId"
        & node (Join-Path $PSScriptRoot 'build-launcher.mjs') $out
        if ($LASTEXITCODE -ne 0) { throw 'Stable launcher compilation failed.' }
        $hash = (Get-FileHash -LiteralPath (Join-Path $out 'tools.json') -Algorithm SHA256).Hash.ToLowerInvariant()
        $launcherHash = (Get-FileHash -LiteralPath (Join-Path $out 'seo-launcher.mjs') -Algorithm SHA256).Hash.ToLowerInvariant()
        $remote = "/tmp/ludoradar-seo-tools-$toolId"
        & gcloud compute scp --recurse $out "ludora:$remote" --project ludora-501213 --zone northamerica-south1-a
        if ($LASTEXITCODE -ne 0) { throw 'Stable tool transfer failed.' }
        # Fixed destinations and validated UUID/hash values only; no mutable checkout imports.
        $remoteInstall = @"
set -eu
test "`$(sha256sum $remote/tools.json | cut -d ' ' -f 1)" = '$hash'
test "`$(sha256sum $remote/seo-launcher.mjs | cut -d ' ' -f 1)" = '$launcherHash'
sudo -n install -d -o mcp13 -g mcp13 -m 0755 /var/lib/ludoradar-seo
sudo -n touch /run/lock/ludoradar-seo-refresh.lock
sudo -n chown mcp13:mcp13 /run/lock/ludoradar-seo-refresh.lock
/usr/bin/node $remote/seo-launcher.mjs install-tools $remote $hash
$launcher install-units
"@
        Invoke-Remote $remoteInstall
    }
    'Prepare' {
        Require-Value 'UiSha' $UiSha; Require-Value 'ServiceSha' $ServiceSha; Require-Value 'DeploymentId' $DeploymentId
        Invoke-Remote "$launcher prepare $DeploymentId $UiSha $ServiceSha"
    }
    'Stage' {
        Require-Value 'DeploymentId' $DeploymentId; Require-Value 'StageId' $StageId
        Invoke-Remote "sudo -n systemctl start ludoradar-seo-stage@$DeploymentId.$StageId.service"
        Invoke-Remote "cat /var/lib/ludoradar-seo/pending-deployments/$DeploymentId/stages/$StageId/status.json /var/lib/ludoradar-seo/pending-deployments/$DeploymentId/stages/$StageId/cgroup.metrics"
    }
    'Finalize' {
        Require-Value 'DeploymentId' $DeploymentId; Require-Value 'StageId' $StageId
        Invoke-Remote "$launcher finalize $DeploymentId $StageId"
        Write-Output 'DEPLOY_STATUS=published'
    }
    'Refresh' {
        Invoke-Remote 'sudo -n systemctl start ludoradar-seo-refresh.service'
        Invoke-Remote 'sudo -n journalctl -u ludoradar-seo-refresh.service -n 12 --no-pager'
        Invoke-Remote "$launcher status"
    }
    'EnableTimer' {
        Require-Value 'UiSha' $UiSha; Require-Value 'RunId' $RunId
        Invoke-Remote "$launcher enable-timer $RunId $UiSha"
        Invoke-Remote 'systemctl list-timers ludoradar-seo-refresh.timer --no-pager'
    }
    'Status' { Invoke-Remote "$launcher status" }
    'Rollback' {
        Require-Value 'GenerationId' $GenerationId
        Invoke-Remote "$launcher rollback $GenerationId"
    }
}
