#!/usr/bin/env python3
"""Stream read-only SSH backup into age; no plaintext backup is written to disk."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


def validate_metadata(value):
    if (not re.fullmatch(r'familytime-\d{8}T\d{6}Z\.tar\.gz', str(value.get('name', '')))
            or not re.fullmatch('[a-f0-9]{64}', str(value.get('sha256', '')))
            or not isinstance(value.get('size'), int) or not 0 < value['size'] < 10 * 1024**3
            or not isinstance(value.get('mtime'), (int, float))):
        raise ValueError('Invalid backup metadata')


def pull(config):
    root = Path(config['backup_dir'])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    ssh = ['/usr/bin/ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
           '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
           '-o', 'UserKnownHostsFile="' + config['known_hosts'] + '"', '-i', config['ssh_key'], config['host']]
    metadata = json.loads(subprocess.check_output([*ssh, 'latest'], timeout=60))
    validate_metadata(metadata)
    if not -300 < time.time() - metadata['mtime'] < 48 * 3600:
        raise RuntimeError('Server backup is older than 48 hours or has invalid time')
    target = root / (metadata['name'] + '.age')
    receipt = root / (metadata['name'] + '.json')
    if target.exists() and receipt.exists():
        saved = json.loads(receipt.read_text())
        with target.open('rb') as handle:
            encrypted_hash = hashlib.file_digest(handle, 'sha256').hexdigest()
        if saved.get('sha256') == metadata['sha256'] and saved.get('encrypted_sha256') == encrypted_hash:
            return metadata['name']
        raise RuntimeError('Existing encrypted backup or receipt has changed')
    temporary = target.with_suffix('.age.partial')
    temporary.unlink(missing_ok=True)
    source = subprocess.Popen([*ssh, 'get ' + metadata['name']], stdout=subprocess.PIPE)
    encrypt = subprocess.Popen([config['age'], '-r', config['recipient'], '-o', str(temporary)], stdin=subprocess.PIPE)
    digest, size = hashlib.sha256(), 0
    try:
        while chunk := source.stdout.read(65536):
            size += len(chunk)
            if size > metadata['size']:
                raise RuntimeError('Backup size exceeded metadata')
            digest.update(chunk)
            encrypt.stdin.write(chunk)
        encrypt.stdin.close()
        if source.wait(timeout=30) != 0 or encrypt.wait(timeout=60) != 0:
            raise RuntimeError('Transfer or encryption failed')
        if size != metadata['size'] or digest.hexdigest() != metadata['sha256']:
            raise RuntimeError('Backup checksum mismatch')
        with temporary.open('rb') as handle:
            os.fsync(handle.fileno())
            metadata['encrypted_sha256'] = hashlib.file_digest(handle, 'sha256').hexdigest()
        os.replace(temporary, target)
        receipt.write_text(json.dumps(metadata))
        for old in sorted(root.glob('familytime-*.tar.gz.age'), reverse=True)[14:]:
            old.unlink()
            old.with_name(old.name.removesuffix('.tar.gz.age') + '.tar.gz.json').unlink(missing_ok=True)
        return metadata['name']
    finally:
        for process in (source, encrypt):
            if process.poll() is None:
                process.kill()
            process.wait()
        temporary.unlink(missing_ok=True)


def main():
    os.umask(0o077)
    config_path = Path(sys.argv[1])
    config = json.loads(config_path.read_text())
    state = config_path.with_name('last-status.json')
    with config_path.with_name('backup.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        # Bound a stalled pipe as well as ordinary subprocess timeouts.
        def timeout(*_):
            raise TimeoutError('Backup timed out')
        signal.signal(signal.SIGALRM, timeout)
        signal.alarm(1800)
        try:
            name = pull(config)
            subprocess.run([sys.executable, str(config_path.with_name('monitor.py'))], check=True, timeout=120)
            result = {'ok': True, 'checked_at': time.time(), 'backup': name}
        except Exception as error:
            result = {'ok': False, 'checked_at': time.time(), 'error': str(error)}
        finally:
            signal.alarm(0)
        previous = json.loads(state.read_text()) if state.exists() else {}
        state.write_text(json.dumps(result))
        if not result['ok'] and previous.get('ok') is not False:
            subprocess.run(['/usr/bin/osascript', '-e', 'display notification "Не удалось проверить backup или доступность. Откройте last-status.json." with title "FamilyTime: требуется внимание"'], check=False)
        print(json.dumps(result))
        if not result['ok']:
            sys.exit(1)


if __name__ == '__main__':
    main()
