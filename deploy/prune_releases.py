#!/usr/bin/python3
"""Root-owned retention utility; never follows unknown release links."""
import fcntl
import re
import shutil
import sys
from pathlib import Path

ROOT = Path('/opt/familytime')
NAME = re.compile(r'(familytime-ci-[0-9a-f]{40}|familytime-\d{8}T\d{6}|restored-\d{8}T\d{6}Z)')


def candidates(root):
    releases = root / 'releases'
    protected = set()
    for name in ('current', 'previous'):
        link = root / name
        if not link.is_symlink():
            raise RuntimeError('Missing trusted ' + name + ' link')
        target = link.resolve(strict=True)
        if target.parent != releases.resolve() or not target.is_dir():
            raise RuntimeError('Release link outside releases')
        protected.add(target)
    paths = [p for p in releases.iterdir()
             if NAME.fullmatch(p.name) and not p.is_symlink() and p.is_dir()]
    paths.sort(key=lambda p: (p.stat().st_mtime_ns, p.name), reverse=True)
    protected.update(p.resolve() for p in paths[:3])
    return [p for p in paths if p.resolve() not in protected]


def main():
    if sys.argv[1:] not in ([], ['--apply']):
        raise RuntimeError('Use no arguments for dry run or --apply')
    with open('/run/lock/familytime-ci.lock', 'a') as ci, open('/run/lock/familytime-maintenance.lock', 'a') as maintenance:
        fcntl.flock(ci, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(maintenance, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if Path('/var/lib/familytime-maintenance/active').exists() or list(ROOT.glob('rollback-data-*')):
            raise RuntimeError('Pending recovery; refusing retention')
        for path in candidates(ROOT):
            print(('Removing ' if '--apply' in sys.argv else 'Would remove ') + str(path))
            if '--apply' in sys.argv:
                shutil.rmtree(path)


if __name__ == '__main__':
    main()
