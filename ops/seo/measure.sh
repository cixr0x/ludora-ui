#!/bin/sh
# Remains in the service cgroup after Node and its flock holder exit.
set -u
state=${LUDORA_SEO_STATE_DIR:-/var/lib/ludoradar-seo}
mode=${1:-}
instance=${2:-}
valid_id() { printf '%s\n' "$1" | LC_ALL=C grep -Eq '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'; }
case "$mode" in
  stage)
    deployment=${instance%%.*}; attempt=${instance#*.}
    valid_id "$deployment" && valid_id "$attempt" || exit 2
    directory="$state/pending-deployments/$deployment/stages/$attempt"
    set -- stage "$deployment" "$attempt"
    ;;
  refresh)
    attempt=$(cat /proc/sys/kernel/random/uuid)
    directory="$state/daily-runs/$attempt"
    set -- refresh "$attempt"
    ;;
  *) exit 2 ;;
esac
cgroup=$(awk -F: '$1 == "0" {print $3}' /proc/self/cgroup)
case "$cgroup" in /system.slice/ludoradar-seo-*) ;; *) echo 'Expected a Ludoradar service cgroup' >&2; exit 2 ;; esac
cg="/sys/fs/cgroup$cgroup"
unit=${cgroup##*/}
started=$(date +%s)
/usr/bin/node --max-old-space-size=256 "$state/bin/seo-launcher.mjs" "$@" &
worker=$!
interrupted=0
trap 'interrupted=1; kill -TERM "$worker" 2>/dev/null || true' TERM INT
wait "$worker"
code=$?
if [ "$interrupted" -ne 0 ]; then wait "$worker" 2>/dev/null; code=143; fi
# Do not claim a final peak while the lock holder is still alive.
remaining=1
tries=0
while [ "$remaining" -ne 0 ] && [ "$tries" -lt 5 ]; do
  remaining=0
  while IFS= read -r pid; do [ "$pid" = "$$" ] || remaining=$((remaining + 1)); done < "$cg/cgroup.procs"
  [ "$remaining" -eq 0 ] || sleep 1
  tries=$((tries + 1))
done
if [ -d "$directory" ] && [ "$(readlink -f "$directory")" = "$directory" ]; then
  temporary="$directory/cgroup.metrics.tmp"
  # All metrics are private state, never served from dist. Missing required files fail the gate.
  {
    printf 'version=1\nunit=%s\ncgroup=%s\nsupervisor_pid=%s\nworker_pid=%s\nworker_exit=%s\nremaining_children=%s\nwall_seconds=%s\n' "$unit" "$cgroup" "$$" "$worker" "$code" "$remaining" "$(($(date +%s) - started))"
    for name in memory.high memory.max cpu.max memory.swap.current memory.swap.peak; do
      if [ -r "$cg/$name" ]; then printf '%s=%s\n' "$(printf '%s' "$name" | tr . _)" "$(cat "$cg/$name")"; fi
    done
    while read -r key value; do printf 'memory_event_%s=%s\n' "$key" "$value"; done < "$cg/memory.events"
    while read -r key value; do printf 'cpu_%s=%s\n' "$key" "$value"; done < "$cg/cpu.stat"
    printf 'memory_peak=%s\n' "$(cat "$cg/memory.peak")"
  } > "$temporary"
  if [ -e "$directory/cgroup.metrics" ]; then echo 'Refusing to replace cgroup evidence' >&2; exit 1; fi
  mv "$temporary" "$directory/cgroup.metrics"
  printf 'SEO_MEASUREMENT=%s/cgroup.metrics\n' "$directory"
fi
[ "$remaining" -eq 0 ] || exit 1
exit "$code"
