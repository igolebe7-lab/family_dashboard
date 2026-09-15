#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>/run/lock/familytime-maintenance.lock
flock -n 9 || { echo 'FamilyTime maintenance already running' >&2; exit 1; }
destination=/var/backups/familytime
install -d -m 0700 "$destination"
release=$(readlink -f /opt/familytime/current)
case "$release" in /opt/familytime/releases/*) ;; *) echo 'Unexpected release path' >&2; exit 1;; esac
required=$(du -sk /var/lib/familytime/pb_data | awk '{print $1}')
available=$(df -Pk "$destination" | awk 'NR==2 {print $4}')
(( available > required + 524288 )) || { echo 'Insufficient backup space' >&2; exit 1; }
restart=0
temporary=''
finish() {
  result=$?
  test -z "$temporary" || rm -f -- "$temporary"
  if (( restart )); then systemctl start familytime-pocketbase.service || result=1; fi
  exit "$result"
}
trap finish EXIT
if systemctl is-active --quiet familytime-pocketbase.service; then
  restart=1
  systemctl stop familytime-pocketbase.service
fi
archive="$destination/familytime-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
temporary="$archive.partial"
# Stopped SQLite: include DB/WAL/files together with the exact executable and VAPID keys.
tar -C / -czf "$temporary" var/lib/familytime/pb_data etc/familytime/backend.env "${release#/}"
test -s "$temporary"
tar -tzf "$temporary" >/dev/null
mv "$temporary" "$archive"
temporary=''
sha256sum "$archive" > "$archive.sha256"
if (( restart )); then systemctl start familytime-pocketbase.service; restart=0; fi
# Keep at least the latest seven archives; never prune before a verified backup exists.
mapfile -t backups < <(find "$destination" -maxdepth 1 -type f -name 'familytime-*.tar.gz' | sort -r)
for ((i=7; i<${#backups[@]}; i++)); do rm -f -- "${backups[i]}" "${backups[i]}.sha256"; done
echo "Backup ready: $archive"
