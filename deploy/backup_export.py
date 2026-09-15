#!/usr/bin/python3
"""Forced SSH command. Read existing completed backups, never execute client commands."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import sys

ROOT = Path('/var/backups/familytime')
NAME = re.compile(r'familytime-\d{8}T\d{6}Z\.tar\.gz')


def main():
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    with open('/run/lock/familytime-maintenance.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_SH)
        if command == 'latest':
            archives = sorted(p for p in ROOT.iterdir() if NAME.fullmatch(p.name) and p.is_file() and not p.is_symlink())
            if not archives:
                raise RuntimeError('No completed backup')
            path = archives[-1]
            checksum = path.with_suffix(path.suffix + '.sha256')
            if checksum.is_symlink():
                raise RuntimeError('Invalid checksum path')
            digest = checksum.read_text().split()[0]
            if not re.fullmatch('[a-f0-9]{64}', digest):
                raise RuntimeError('Invalid checksum')
            print(json.dumps({'name': path.name, 'sha256': digest,
                              'size': path.stat().st_size, 'mtime': path.stat().st_mtime}))
        elif command.startswith('get ') and NAME.fullmatch(command[4:]):
            path = ROOT / command[4:]
            if path.is_symlink() or not path.is_file():
                raise RuntimeError('Invalid archive')
            with path.open('rb') as source:
                shutil.copyfileobj(source, sys.stdout.buffer)
        else:
            raise RuntimeError('Only latest and get BACKUP are allowed')


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
