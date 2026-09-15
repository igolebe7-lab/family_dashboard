#!/usr/bin/env python3
"""Install the owner's launch agent. No credentials are written into the repository."""
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys


def main():
    os.umask(0o077)
    root = Path.home() / 'Library/Application Support/FamilyTimeBackup'
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    age = shutil.which('age')
    if not age:
        raise RuntimeError('Install age first')
    identity = root / 'identity.age'
    if not identity.exists():
        subprocess.run([str(Path(age).with_name('age-keygen')), '-o', str(identity)], check=True)
    recipient = subprocess.check_output([str(Path(age).with_name('age-keygen')), '-y', str(identity)], text=True).strip()
    key = root / 'ssh_key'
    if not key.exists():
        subprocess.run(['/usr/bin/ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'familytime-mac-backup-read-only', '-f', str(key)], check=True)
    shutil.copyfile(sys.argv[1], root / 'known_hosts')
    for name in ('mac_backup.py', 'monitor.py'):
        shutil.copyfile(Path(__file__).with_name(name), root / name)
    config = {'backup_dir': str(root / 'archives'), 'ssh_key': str(key), 'known_hosts': str(root / 'known_hosts'),
              'host': 'familytime-backup@147.45.136.245', 'age': age, 'recipient': recipient}
    (root / 'config.json').write_text(json.dumps(config, indent=2))
    agent = Path.home() / 'Library/LaunchAgents/com.familytime.backup.plist'
    agent.parent.mkdir(parents=True, exist_ok=True)
    with agent.open('wb') as output:
        plistlib.dump({'Label': 'com.familytime.backup', 'ProgramArguments': [sys.executable, str(root / 'mac_backup.py'), str(root / 'config.json')],
                      'StartInterval': 3600, 'RunAtLoad': True,
                      'StandardOutPath': str(root / 'agent.log'), 'StandardErrorPath': str(root / 'agent-error.log')}, output)
    print('Installed configuration at ' + str(root))
    print('Public SSH key: ' + str(key) + '.pub')
    print('Launch agent prepared; bootstrap after server key installation.')


if __name__ == '__main__':
    main()
