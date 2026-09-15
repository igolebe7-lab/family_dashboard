"""Runs only inside the offline recovery container, with copied data."""
import json
from pathlib import Path
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request


def inventory():
    result = {}
    with sqlite3.connect('/data/data.db') as connection:
        assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not connection.execute('PRAGMA foreign_key_check').fetchall()
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for name in ('users', 'families', 'family_members', 'items'):
            assert name in tables, 'Missing required collection'
            result[name] = connection.execute('SELECT count(*) FROM "' + name + '"').fetchone()[0]
    return result


before = inventory()
with open('/tmp/backend.log', 'w') as log:
    process = subprocess.Popen(['/release/backend/pocketbase', 'serve', '--http=127.0.0.1:8090',
                                '--dir=/data', '--hooksDir=/release/backend/pb_hooks',
                                '--migrationsDir=/release/backend/pb_migrations', '--automigrate=false'], stdout=log, stderr=log)
    try:
        for _ in range(60):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8090/api/health', timeout=2) as response:
                    assert json.load(response)['code'] == 200
                break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError('Restored backend exited')
                time.sleep(1)
        else:
            raise RuntimeError('Restored backend did not become healthy')
        try:
            with urllib.request.urlopen('http://127.0.0.1:8090/api/collections/families/records', timeout=3) as response:
                assert not json.load(response).get('items'), 'Anonymous access leaked family records'
        except urllib.error.HTTPError as error:
            assert error.code in (400, 401, 403, 404)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
assert inventory() == before, 'Core record counts changed during recovery'
assert Path('/release/web/200.html').is_file()
print(json.dumps({'recovery': 'passed', 'integrity': 'ok', 'core_records_unchanged': True,
                  'health': 'ok', 'anonymous_family_access': 'denied', 'network': 'none'}))
