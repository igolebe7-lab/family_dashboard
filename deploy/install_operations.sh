#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
source_dir=${1:?Trusted directory containing reviewed deployment utilities}
public_key=${2:?Path to Mac public SSH key}
previous=${3:?Known previous successful release}
test -d "$previous"
case "$previous" in /opt/familytime/releases/*) ;; *) exit 1;; esac
install -o root -g root -m 0755 "$source_dir/receive.py" /usr/local/sbin/familytime-deploy
install -o root -g root -m 0755 "$source_dir/prune_releases.py" /usr/local/lib/familytime/prune_releases.py
install -o root -g root -m 0755 "$source_dir/backup_export.py" /usr/local/sbin/familytime-backup-export
if ! test -L /opt/familytime/previous; then ln -s "$previous" /opt/familytime/previous; fi
if ! id familytime-backup >/dev/null 2>&1; then
  useradd --system --home-dir /home/familytime-backup --shell /bin/sh familytime-backup
fi
install -d -o root -g root -m 0755 /home/familytime-backup /home/familytime-backup/.ssh
test "$(wc -l < "$public_key")" -eq 1
printf 'restrict,command="sudo -n /usr/local/sbin/familytime-backup-export" %s\n' "$(cat "$public_key")" > /home/familytime-backup/.ssh/authorized_keys
chmod 0644 /home/familytime-backup/.ssh/authorized_keys
printf '%s\n' 'Defaults:familytime-backup env_keep += "SSH_ORIGINAL_COMMAND"' 'familytime-backup ALL=(root) NOPASSWD: /usr/local/sbin/familytime-backup-export ""' > /etc/sudoers.d/familytime-backup
chmod 0440 /etc/sudoers.d/familytime-backup
visudo -cf /etc/sudoers.d/familytime-backup
install -o root -g root -m 0644 "$source_dir/familytime-prune.service" "$source_dir/familytime-prune.timer" /etc/systemd/system/
systemctl daemon-reload
python3 /usr/local/lib/familytime/prune_releases.py
echo 'Installed. Enable the timer only after reviewing retention dry run.'
