# Stage 14.11 Operations

**Goal:** protect main, retain releases, keep encrypted backups on the owner's Mac,
monitor public health/TLS, and prove recovery without touching VPN or production data.
**Architecture:** root-owned server utilities; read-only forced SSH backup exporter;
Mac launch agent with age encryption; GitHub external checks; offline Docker recovery.
**Spec:** owner approved this design and selected Mac storage in this conversation.

- [x] 14.11.1: require `verify` from GitHub Actions, PRs, current base, no force/delete;
  enforce for admins, zero mandatory reviewers (single owner). Prove by a real PR.
- [x] 14.11.2: test retention selection with current/previous/latest three, unknown paths,
  symlinks and pending maintenance. Install root-owned daily timer, dry run then apply.
- [x] 14.11.3: test backup names/checksums, stream through age, atomic publication,
  daily source + hourly Mac retry/dedup, retain 14 encrypted copies; no plaintext archive.
  Install read-only forced key and launch agent; verify an actual copy/decryption.
- [x] 14.11.4: test certificate threshold and incident deduplication; GitHub checks every
  15 minutes, health + TLS + commit, one assigned incident, close on recovery.
  Document schedule delays/60-day inactivity; Mac also checks hourly when running.
- [x] 14.11.5: decrypt locally into private temporary directory; validate archive paths;
  run exact Linux executable in Docker with no network, resource limits, no production
  env. Check SQLite integrity/counts, files, API health and anonymous access; clean up.
- [x] Commit/PR/CI/merge, actual deployment, repeat health/VPN checks and publish report.

## Evidence

- PR #2 was BLOCKED while verify ran, then merged without bypass.
- Full CI/deploy passed: https://github.com/igolebe7-lab/family_dashboard/actions/runs/35020067524
- External monitor passed: https://github.com/igolebe7-lab/family_dashboard/actions/runs/35020081088
- 11 operations/receiver unit tests passed; full frontend/backend CI passed.
- Encrypted backup `familytime-20260915T202101Z.tar.gz.age` recovered offline on Mac.
- Launch agent exit 0; read-only key rejected `id`; retention timer active.
- WG active, Amnezia restart count 0, original July 10 start time unchanged.
- Incident create/deduplicate/close decisions tested locally; no real outage injected.

Constraints: no new production runtime, no VPN/firewall changes, secrets outside git,
no plaintext backups or user data in public GitHub artifacts/issues. The Mac must be
awake for copies/checks; no claim of continuous monitoring or disaster recovery of VPS/VPN.
