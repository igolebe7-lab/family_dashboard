#!/usr/bin/env bash
set -euo pipefail
umask 077
archive=${1:?Pass a trusted FamilyTime backup archive}
test "${2:-}" = --confirm-restore || { echo 'Restore stops FamilyTime and replaces its data. Add --confirm-restore.' >&2; exit 1; }
test -f "$archive.sha256"
expected=$(awk 'NR==1 {print $1}' "$archive.sha256")
actual=$(sha256sum "$archive" | awk '{print $1}')
test "$actual" = "$expected" || { echo 'Backup checksum mismatch' >&2; exit 1; }
exec 9>/run/lock/familytime-maintenance.lock
flock -n 9 || { echo 'FamilyTime maintenance already running' >&2; exit 1; }
# Never extract arbitrary user-supplied archives. These contain credentials.
staging=$(mktemp -d /var/lib/familytime-restore.XXXXXXXX)
tar --no-same-owner -xzf "$archive" -C "$staging"
test -f "$staging/var/lib/familytime/pb_data/data.db"
test -f "$staging/etc/familytime/backend.env"
mapfile -t releases < <(find "$staging/opt/familytime/releases" -mindepth 1 -maxdepth 1 -type d)
test "${#releases[@]}" = 1
test -x "${releases[0]}/backend/pocketbase"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
systemctl stop familytime-pocketbase.service
# Retain previous data and executable for investigation; never delete them automatically.
mv /var/lib/familytime/pb_data "/var/lib/familytime/pb_data.before-$stamp"
mv "$staging/var/lib/familytime/pb_data" /var/lib/familytime/pb_data
chown -R familytime:familytime /var/lib/familytime/pb_data
install -m 0640 -o root -g familytime "$staging/etc/familytime/backend.env" /etc/familytime/backend.env
target="/opt/familytime/releases/restored-$stamp"
mv "${releases[0]}" "$target"
chmod -R a+rX "$target"
ln -s "$target" /opt/familytime/restore-next
mv -Tf /opt/familytime/restore-next /opt/familytime/current
systemctl start familytime-pocketbase.service
echo "Restored. Previous data retained; inspect $staging before removing it."
echo 'Check /api/health, account access, reminders, push and both VPN connections.'
