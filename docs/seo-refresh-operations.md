# Daily comparison publication

The minimum public service runtime change is `f975d302e2b0727a83da720aa7fb08a9d914870d`. Supply the exact reviewed and deployed service checkout SHA, including later documentation commits, and the exact reviewed UI commit to preparation. `prepared.json`, the retained `release.json`, the selected `manifest.json`, and finalization status record the relevant full SHAs. Installation is complete only after those values agree and the public checks pass. This document describes the procedure; it does not claim production execution or a natural timer event.

Production uses Node `/usr/bin/node` 18.20.4 on VM `ludora`, project `ludora-501213`, zone `northamerica-south1-a`. Source checkouts are `/opt/ludora/ludora-ui` and `/opt/ludora/ludora-service`. The API origin is `http://127.0.0.1:4000`. No step executes SQL.

| Purpose | Path |
| --- | --- |
| Stable bundled launcher | `/var/lib/ludoradar-seo/bin/seo-launcher.mjs` |
| Measurement supervisor | `/var/lib/ludoradar-seo/bin/measure.sh` |
| Shared kernel lock | `/run/lock/ludoradar-seo-refresh.lock` |
| Selected public root | `/opt/ludora/ludora-ui/dist` |
| Managed generations | `/var/lib/ludoradar-seo/generations/<generation UUID>/` |
| Retained code and assets | `/var/lib/ludoradar-seo/runtimes/<SHA prefix>-<deployment UUID>/` |
| Pending compilation and stage receipts | `/var/lib/ludoradar-seo/pending-deployments/<deployment UUID>/` |
| Daily result and cgroup evidence | `/var/lib/ludoradar-seo/daily-runs/<run UUID>/` |
| Last worker result | `/var/lib/ludoradar-seo/status.json` |
| Narrow Nginx snippet | `/etc/nginx/snippets/ludora-app.conf` |

State and public directories need `mcp13:mcp13` ownership and mode 0755; public files need read access for Nginx. `dist` selects only a generation's `public/` directory. Private manifests, routes, receipts and executable code remain outside that root.

## Reviewed deployment sequence

Run from the exact reviewed UI checkout in PowerShell. The wrapper verifies local tool source, bundles a self-contained launcher, verifies uploaded hashes before execution, then atomically installs stable tools under the shared lock. Unit installation reloads systemd without enabling the timer. Linux shell/unit files are retained with LF endings.

```powershell
$ui = (git rev-parse HEAD).Trim()
$service = (git -C C:/PROJECTS/ludora/ludora-service rev-parse HEAD).Trim()
$deployment = [guid]::NewGuid().ToString()
$stage = [guid]::NewGuid().ToString()
./ops/seo/Deploy-LudoraSeo.ps1 -Action InstallTools -UiSha $ui
./ops/seo/Deploy-LudoraSeo.ps1 -Action Prepare -UiSha $ui -ServiceSha $service -DeploymentId $deployment
./ops/seo/Deploy-LudoraSeo.ps1 -Action Stage -DeploymentId $deployment -StageId $stage
# Inspect the complete candidate and cgroup evidence before this publication step.
./ops/seo/Deploy-LudoraSeo.ps1 -Action Finalize -DeploymentId $deployment -StageId $stage
./ops/seo/Deploy-LudoraSeo.ps1 -Action Refresh
# Use the daily UUID printed by SEO_MEASUREMENT in the exact service journal.
./ops/seo/Deploy-LudoraSeo.ps1 -Action EnableTimer -UiSha $ui -RunId '<daily UUID>'
./ops/seo/Deploy-LudoraSeo.ps1 -Action Status
```

The three phases acquire and release the real lock independently:

1. **Prepare** preserves tracked changes by refusing a dirty checkout, fetches and checks out the full requested SHA, runs `npm ci`, and compiles into private pending state. It fetches no catalog and publishes no HTML. The receipt binds the source paths, UI/API commits, complete runtime tree hash, selected runtime identity and expected Nginx baseline. Untracked backups and worktrees remain untouched.
2. **Stage** runs `ludoradar-seo-stage@<deployment UUID>.<stage UUID>.service`. A fresh Node process loads only stable launcher code, acquires its own lock, verifies the source/runtime/base, then imports the retained worker. It fetches one complete export and renders every page with `reusePages:false`. It retains original significant publication dates, preceding assets, and a compact catalog index. It cleans the export spool before writing `generated.json`; it neither publishes nor prunes. `generated` is not deployment success.
3. **Finalize** requires a successful worker exit and matching resource evidence, then compares the exact selected generation/path/manifest hash against the staged base. Even a daily generation using the same UI/runtime supersedes an older stage. It verifies every staged file, backs up and installs only the required Nginx snippet, runs `nginx -t` and reloads, retargets only private runtime-path metadata, and performs same-filesystem managed renames and publication under the lease. It verifies the selected UI/runtime/generation before retention. Only `published` is success.

Compilation and finalization are outside the cold worker's time/memory measurement. Neither the stage nor daily launcher imports Vite or mutable checkout modules before locking. Ordinary `npm run build` still emits nonindexable output; `npm run build:indexable` still compiles and publishes indexable output using its original combined command. Use the three-phase procedure for the production capacity gate.

## Resource evidence and service verification

Both stage and daily services set Nice 10, CPUQuota 50%, MemoryHigh 320M, MemoryMax 384M, TimeoutStartSec 600, TimeoutStopSec 10 and KillMode control-group. Node receives `--max-old-space-size=256`; the worker deadline is 590 seconds. Do not increase these caps to pass a failed run.

`measure.sh` stays inside the service cgroup until the worker and kernel-lock holder exit, then records `memory.peak`, every `memory.events` counter, `cpu.stat`, `cpu.max`, memory high/max, wall time, exit code, process IDs and remaining-child count. Optional `memory.swap.current`/`memory.swap.peak` are recorded when readable. Its own memory is included. The generated/daily receipt records the Node version, heap flag/limit, Nice, and matching worker/holder cgroup membership. Main-process RSS is supplementary evidence.

The gate rejects missing/incomplete metrics, nonzero exit, remaining children, an exceeded deadline, OOM/max events, mismatched process/cgroup identity, or limits different from the approved policy. MemoryHigh events may show soft throttling and remain visible for review. Systemd 252 does not expose MemoryPeak through `systemctl show`; use the retained cgroup file evidence.

```sh
/usr/bin/node /var/lib/ludoradar-seo/bin/seo-launcher.mjs status
sudo systemctl show ludoradar-seo-refresh.service -p Result -p ExecMainStatus -p Nice -p CPUQuotaPerSecUSec -p MemoryHigh -p MemoryMax -p TimeoutStartUSec
sudo journalctl -u ludoradar-seo-refresh.service -n 40 --no-pager
systemctl cat ludoradar-seo-refresh.timer
systemctl list-timers ludoradar-seo-refresh.timer --no-pager
systemd-analyze calendar '*-*-* 06:00:00 UTC'
```

The timer runs daily at 06:00 UTC with `Persistent=true` and one-minute accuracy. Before enabling it, run its exact service manually, verify selected SHA/generation and inspect its `daily-runs/<UUID>/result.json` and `cgroup.metrics`. `enable-timer` checks that successful exact-service evidence against the selected generation. Verify lock exclusion during that run. This proves the service and schedule; report explicitly that the next natural calendar firing has not yet occurred.

During the full cold stage, monitor the existing homepage and public API service independently. Inspect the complete candidate's HTML, route graph, canonicals, prices/schema and sitemap/lastmod consistency before finalization. After publication, verify representative product, zero-offer, expansion, catalog page 2/last page, category, wrong-slug redirects and true 404 routes in normal and no-JavaScript browsers. Google live inspection, Rich Results Test and sitemap/recrawl submission follow technical validation; accepted requests do not prove indexing or ranking.

## Failure, retry and rollback

Exit 75 means the lock was busy; 76 means the candidate was superseded. Neither means success. Busy finalization may retry the same stage if the exact base remains unchanged. After a daily refresh supersedes it, choose a new stage UUID and rerun only Stage/Finalize: the verified compilation is reusable if source SHA and selected runtime still match preparation. A newer UI/runtime requires a new deployment UUID and preparation. IDs and immutable request files are single-use.

Failures before publication preserve the selected site. Finalization restores moved candidates to their own pending paths and the old Nginx configuration where possible; `finalize-status.json` reports actual runtime/generation locations and any rollback errors. Never assume a path moved back when that record says otherwise. A cleanup failure after publication is `failed` with `publicationCompleted:true`; the selected output is preserved. Inspect and resolve it before reporting success or enabling the timer.

`publication.json` preserves immutable publication and rollback provenance before cleanup. Repeating Finalize verifies the selected identity and retained output, writes `finalize-retry-status.json`, and preserves the original finalization record. It reports superseded if another generation is selected and keeps an original cleanup failure as failed; it does not rerun publication or hide that failure.

Successful publication retains the current and previous complete managed generations and referenced runtimes/preceding hashed assets. Pending deployments are outside these pruning roots. Failed stages and receipts remain private for audit; small daily receipts do not retain another generated site. Cleanup never touches unrelated paths or the bootstrap legacy backup. Preserve `/opt/ludora/ludora-ui-dist.before-seo-20260908T015037Z` separately.

Disable the timer before rollback. For a previous managed generation, use its verified UUID:

```sh
sudo systemctl disable --now ludoradar-seo-refresh.timer
/usr/bin/node /var/lib/ludoradar-seo/bin/seo-launcher.mjs rollback PREVIOUS_GENERATION_UUID
```

The first conversion preserves the real dist at `dist.previous-<UUID>`. To restore that first deployment's legacy output and recorded previous Nginx snippet:

```sh
/usr/bin/node /var/lib/ludoradar-seo/bin/seo-launcher.mjs rollback-legacy DEPLOYMENT_UUID STAGE_UUID
```

This Linux-only command validates the recorded backup's resolved path and complete tree hash under the shared lock, validates/restores Nginx, and atomically selects the preserved directory. It does not delete the managed output. Always recheck public routes, selected metadata and service state after rollback; leave the timer disabled until a managed release passes validation again.
