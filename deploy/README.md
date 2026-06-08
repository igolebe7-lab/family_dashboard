# Deployment

Deployment files will be added in the production package stage:

- `Caddyfile`
- `family-pocketbase.service`
- `backup.sh`
- `restore.md`

Target production model:

- Caddy serves static SvelteKit build.
- Caddy reverse proxies PocketBase API/admin routes.
- PocketBase runs as systemd service.
- `pb_data` is backed up regularly.
