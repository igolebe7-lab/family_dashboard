#!/usr/bin/env python3
"""Decrypt a Mac backup into temporary storage and boot exact Linux code offline."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid

IMAGE = 'python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea'


def allowed(entry):
    name = entry.name.rstrip('/')
    path = PurePosixPath(name)
    return (str(path) == name and not path.is_absolute() and '..' not in path.parts
            and (entry.isdir() or entry.isfile())
            and (name == 'etc/familytime/backend.env' or name == 'var/lib/familytime/pb_data'
                 or name.startswith('var/lib/familytime/pb_data/')
                 or re.match(r'^opt/familytime/releases/[A-Za-z0-9-]+(?:/|$)', name) is not None))


def main():
    os.umask(0o077)
    config_path = Path(sys.argv[1])
    config = json.loads(config_path.read_text())
    archive = sorted(Path(config['backup_dir']).glob('familytime-*.tar.gz.age'))[-1]
    metadata = json.loads(archive.with_suffix('.json').read_text())
    with archive.open('rb') as handle:
        if hashlib.file_digest(handle, 'sha256').hexdigest() != metadata['encrypted_sha256']:
            raise RuntimeError('Encrypted archive checksum mismatch')
    with tempfile.TemporaryDirectory(prefix='familytime-recovery-') as temporary:
        root = Path(temporary)
        process = subprocess.Popen([config['age'], '-d', '-i', str(config_path.with_name('identity.age')), str(archive)], stdout=subprocess.PIPE)
        try:
            seen, size = set(), 0
            with tarfile.open(fileobj=process.stdout, mode='r|gz') as tar:
                for entry in tar:
                    if not allowed(entry) or entry.name in seen:
                        raise RuntimeError('Unsafe recovery archive entry')
                    seen.add(entry.name)
                    size += entry.size
                    if size > 10 * 1024**3 or len(seen) > 100000:
                        raise RuntimeError('Recovery archive exceeds limits')
                    destination = root / entry.name
                    if entry.isdir():
                        destination.mkdir(parents=True, exist_ok=True)
                    else:
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        with tar.extractfile(entry) as source, destination.open('xb') as output:
                            shutil.copyfileobj(source, output)
                        destination.chmod(0o700 if entry.name.endswith('/backend/pocketbase') else 0o600)
            while process.stdout.read(65536):
                pass
            if process.wait(timeout=30):
                raise RuntimeError('Backup authentication/decryption failed')
        finally:
            if process.poll() is None:
                process.kill()
            process.wait()
        releases = list((root / 'opt/familytime/releases').iterdir())
        if len(releases) != 1:
            raise RuntimeError('Expected one exact release')
        data = root / 'var/lib/familytime/pb_data'
        if not (data / 'data.db').is_file() or not (root / 'etc/familytime/backend.env').is_file():
            raise RuntimeError('Missing recovery data')
        name = 'familytime-recovery-' + uuid.uuid4().hex[:12]
        try:
            subprocess.run(['docker', 'run', '--rm', '--name', name, '--platform', 'linux/amd64',
                            '--network', 'none', '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
                            '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                            '--tmpfs', '/tmp:rw,nosuid,size=64m', '-e', 'GOMEMLIMIT=256MiB', '-e', 'GOMAXPROCS=1',
                            '-v', str(data) + ':/data:rw', '-v', str(releases[0]) + ':/release:ro',
                            '-v', str(Path(__file__).with_name('recovery_probe.py').resolve()) + ':/probe.py:ro',
                            IMAGE, 'python', '/probe.py'], check=True, timeout=180)
        finally:
            subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print('Verified encrypted backup: ' + archive.name)
        print('Temporary plaintext and container removed on exit; production was not used.')


if __name__ == '__main__':
    main()
