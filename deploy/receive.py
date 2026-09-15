#!/usr/bin/python3
"""Root-owned receiver; uploaded code runs only as the application user."""
import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import urllib.error

ROOT = Path('/opt/familytime')
DATA = Path('/var/lib/familytime/pb_data')
MARKER = Path('/var/lib/familytime-maintenance/active')


def validate(archive):
    names, size = set(), 0
    for entry in archive:
        name = entry.name.rstrip('/')
        path = PurePosixPath(name)
        allowed = name in ['release.json', 'web', 'backend', 'backend/pocketbase', 'backend/pb_hooks', 'backend/pb_migrations'] or name.startswith(('web/', 'backend/pb_hooks/', 'backend/pb_migrations/'))
        if (not name or str(path) != name or path.is_absolute() or '..' in path.parts
                or not allowed or not (entry.isfile() or entry.isdir()) or name in names):
            raise ValueError('Unsafe archive entry')
        names.add(name)
        size += entry.size
        if len(names) > 10000 or size > 256 * 1024 * 1024:
            raise ValueError('Archive exceeds limits')
    for name in ['web/200.html', 'release.json', 'backend/pocketbase']:
        if name not in names or not archive.getmember(name).isfile():
            raise ValueError('Missing required file')
    if archive.getmember('release.json').size > 1024:
        raise ValueError('Invalid metadata')
    data = json.load(archive.extractfile('release.json'))
    if not isinstance(data, dict) or not re.fullmatch('[0-9a-f]{40}', str(data.get('commit', ''))):
        raise ValueError('Invalid commit')
    return data


def run(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Command failed: ' + args[0] + ': ' + result.stdout[-2000:])
    return result.stdout


def health():
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8090/api/health', timeout=2) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError('Backend unavailable')


def switch(target):
    next_link = ROOT / 'ci-next'
    if next_link.exists() or next_link.is_symlink():
        raise RuntimeError('Unexpected pending symlink')
    next_link.symlink_to(target)
    os.replace(next_link, ROOT / 'current')


def preflight(release, stage):
    clone = stage / 'test-data'
    clone.mkdir()
    with sqlite3.connect('file:' + str(DATA / 'data.db') + '?mode=ro', uri=True) as source:
        with sqlite3.connect(clone / 'data.db') as target:
            source.backup(target)
    stage.chmod(0o755)
    run('chown', '-R', 'familytime-check:familytime-check', str(clone))
    unit = 'familytime-ci-preflight'
    try:
        run('systemd-run', '--quiet', '--collect', '--unit=' + unit,
            '-p', 'User=familytime-check', '-p', 'Group=familytime-check', '-p', 'PrivateNetwork=yes',
            '-p', 'PrivateTmp=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes',
            '-p', 'NoNewPrivileges=yes', '-p', 'InaccessiblePaths=/var/lib/familytime /etc/familytime /var/backups/familytime',
            '-p', 'ReadWritePaths=' + str(clone), '-p', 'MemoryMax=180M', '-p', 'CPUQuota=25%',
            '-p', 'RuntimeMaxSec=120', '-E', 'GOMEMLIMIT=120MiB', '-E', 'GOMAXPROCS=1',
            str(release / 'backend/pocketbase'), 'serve', '--http=127.0.0.1:8099',
            '--dir=' + str(clone), '--hooksDir=' + str(release / 'backend/pb_hooks'),
            '--migrationsDir=' + str(release / 'backend/pb_migrations'), '--automigrate=false')
        ready = False
        for _ in range(45):
            pid = run('systemctl', 'show', unit, '-p', 'MainPID', '--value').strip()
            if pid != '0':
                result = subprocess.run(['nsenter', '-t', pid, '-n', 'curl', '-fsS', '--max-time', '2', 'http://127.0.0.1:8099/api/health'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if result.returncode == 0:
                    ready = True
                    break
            time.sleep(1)
        if not ready:
            raise RuntimeError('Candidate failed isolated startup/migrations')
    finally:
        subprocess.run(['systemctl', 'stop', unit], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with sqlite3.connect(clone / 'data.db') as database:
        if database.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or database.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Migrated database integrity failure')
    print('Isolated migration and integrity checks passed', flush=True)


def activate(target, old, commit):
    rollback = ROOT / ('rollback-data-' + commit)
    if rollback.exists() or MARKER.exists():
        raise RuntimeError('Pending maintenance; operator intervention required')
    MARKER.touch(mode=0o644)
    # The receiver's restrictive umask must not hide the gate from Caddy.
    MARKER.chmod(0o644)
    try:
        try:
            urllib.request.urlopen('https://147.45.136.245/api/health', timeout=10)
            raise RuntimeError('Maintenance gate is not active')
        except urllib.error.HTTPError as error:
            if error.code != 503:
                raise
    except BaseException:
        MARKER.unlink(missing_ok=True)
        raise
    run('systemctl', 'stop', 'familytime-pocketbase')
    activated = False
    try:
        shutil.copytree(DATA, rollback)
        switch(target)
        activated = True
        run('systemctl', 'reset-failed', 'familytime-pocketbase')
        run('systemctl', 'start', 'familytime-pocketbase')
        health()
    except BaseException:
        run('systemctl', 'stop', 'familytime-pocketbase')
        if activated:
            DATA.rename(ROOT / ('failed-data-' + commit))
            rollback.rename(DATA)
            run('chown', '-R', 'familytime:familytime', str(DATA))
            switch(old)
        run('systemctl', 'reset-failed', 'familytime-pocketbase')
        run('systemctl', 'start', 'familytime-pocketbase')
        health()
        MARKER.unlink(missing_ok=True)
        raise
    MARKER.unlink()
    shutil.rmtree(rollback)
    previous = ROOT / 'previous-next'
    previous.symlink_to(old)
    os.replace(previous, ROOT / 'previous')


def receive():
    old = (ROOT / 'current').resolve(strict=True)
    if old.parent != ROOT / 'releases' or MARKER.exists():
        raise RuntimeError('Unexpected release or active maintenance')
    if shutil.disk_usage(ROOT).free < 1024 * 1024 * 1024:
        raise RuntimeError('Less than 1 GiB free')
    with tempfile.TemporaryDirectory(prefix='.ci-', dir=ROOT) as temporary:
        stage = Path(temporary)
        compressed = stage / 'upload.tar.gz'
        size = 0
        with compressed.open('wb') as output:
            while True:
                chunk = sys.stdin.buffer.read(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > 64 * 1024 * 1024:
                    raise ValueError('Upload exceeds 64 MiB')
                output.write(chunk)
        with tarfile.open(compressed, 'r:gz') as archive:
            metadata = validate(archive)
            target = ROOT / 'releases' / ('familytime-ci-' + metadata['commit'])
            if target.exists():
                raise RuntimeError('Commit already uploaded; create a new commit')
            release = stage / 'release'
            release.mkdir()
            for entry in archive.getmembers():
                path = release / entry.name
                if entry.isdir():
                    path.mkdir(parents=True, exist_ok=True)
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(entry) as source, path.open('xb') as output:
                        shutil.copyfileobj(source, output)
            # Deployment tooling is installed by an administrator, not by the payload.
            shutil.copytree(old / 'deploy', release / 'deploy')
            assets = old / 'web/_app/immutable'
            for source in assets.rglob('*'):
                destination = release / 'web/_app/immutable' / source.relative_to(assets)
                if source.is_file() and not destination.exists():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, destination)
            (release / 'web/release.json').write_text(json.dumps(metadata))
            for path in release.rglob('*'):
                path.chmod(0o755 if path.is_dir() or path == release / 'backend/pocketbase' else 0o644)
            release.chmod(0o755)
            preflight(release, stage)
            print(run('bash', '/usr/local/lib/familytime/backup.sh'), flush=True)
            health()
            with open('/run/lock/familytime-maintenance.lock', 'w') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                if (ROOT / 'current').resolve() != old:
                    raise RuntimeError('Current release changed concurrently')
                release.rename(target)
                activate(target, old, metadata['commit'])
    print('Deployed commit ' + metadata['commit'], flush=True)
    print('Previous release: ' + str(old), flush=True)


if __name__ == '__main__':
    try:
        if os.geteuid() != 0 or len(sys.argv) != 1:
            raise RuntimeError('Use the restricted deployment command')
        os.umask(0o077)
        os.nice(10)
        with open('/run/lock/familytime-ci.lock', 'w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            receive()
    except Exception as error:
        print('Deployment rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
