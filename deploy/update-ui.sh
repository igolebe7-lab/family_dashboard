#!/usr/bin/env bash
# UI-only release: refuses backend, hook or migration changes.
set -euo pipefail
umask 077
archive=${1:?Usage: bash update-ui.sh /absolute/path/familytime-TIMESTAMP.tar.gz}
name=$(basename "$archive" .tar.gz)
[[ "$name" =~ ^familytime-[0-9]{8}T[0-9]{6}$ ]] || { echo 'Invalid release name' >&2; exit 1; }
[[ "$archive" = /* && -f "$archive" && $EUID = 0 ]]
old=$(readlink -f /opt/familytime/current)
target=/opt/familytime/releases/$name
[[ "$old" == /opt/familytime/releases/familytime-* && ! -e "$target" ]]
# Only use archives built from this trusted repository.
tar -tzf "$archive" | awk -v prefix="$name/" '
  index($0, prefix) != 1 || $0 ~ /(^|\/)\.\.(\/|$)/ || $0 ~ /(^|\/)\._/ { bad=1 }
  END { exit bad }'
tar -xzf "$archive" -C /opt/familytime/releases
cd "$target"
sha256sum --check --quiet SHA256SUMS
diff -qr "$old/backend" "$target/backend"
cp -an "$old/web/_app/immutable/." "$target/web/_app/immutable/"
chmod -R a+rX "$target"
bash "$old/deploy/backup.sh"
ready=0
for ((attempt=0; attempt<30; attempt++)); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8090/api/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ "$ready" = 1 ]] || { echo 'Backend did not become ready after backup' >&2; exit 1; }
exec 9>/run/lock/familytime-maintenance.lock
flock -n 9
[[ "$(readlink -f /opt/familytime/current)" = "$old" ]]
next=/opt/familytime/update-ui-next
[[ ! -e "$next" && ! -L "$next" ]]
switched=0
rollback() {
  result=$?
  if ((result && switched)); then
    ln -s "$old" "$next"
    mv -Tf "$next" /opt/familytime/current
    echo "Rolled back to $old" >&2
  fi
  exit "$result"
}
trap rollback EXIT
ln -s "$target" "$next"
mv -Tf "$next" /opt/familytime/current
switched=1
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8090/api/health
curl --fail --silent --show-error --max-time 15 https://147.45.136.245/app/today >/dev/null
echo "Active: $target"
echo "Previous: $old"
echo 'UI-only update. VPN, Caddy configuration and database schema unchanged.'
