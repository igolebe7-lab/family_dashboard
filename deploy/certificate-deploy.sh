#!/usr/bin/env bash
set -euo pipefail
umask 077
# Certbot invokes this only after a successful renewal, not on every timer tick.
: "${RENEWED_LINEAGE:?Certbot must provide RENEWED_LINEAGE}"
ip=147.45.136.245
test "$(basename "$RENEWED_LINEAGE")" = "$ip" || exit 0
openssl x509 -in "$RENEWED_LINEAGE/fullchain.pem" -noout -checkip "$ip"
openssl x509 -in "$RENEWED_LINEAGE/fullchain.pem" -noout -checkend 86400
root=/etc/familytime/tls
install -d -m 0750 -o root -g caddy "$root"
version=$(mktemp -d "$root/cert.XXXXXXXX")
chown root:caddy "$version"
chmod 0750 "$version"
install -m 0640 -o root -g caddy "$RENEWED_LINEAGE/fullchain.pem" "$version/fullchain.pem"
install -m 0640 -o root -g caddy "$RENEWED_LINEAGE/privkey.pem" "$version/privkey.pem"
ln -s "$version" "$root/next"
mv -Tf "$root/next" "$root/current"
systemctl reload familytime-caddy.service
echo 'FamilyTime certificate installed and reloaded'
