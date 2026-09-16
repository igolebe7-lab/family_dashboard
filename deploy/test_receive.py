import importlib.util
import io
import os
import json
import tarfile
import unittest
from unittest.mock import patch
from pathlib import Path
import tempfile
import urllib.error

spec = importlib.util.spec_from_file_location('receive', 'deploy/receive.py')
receive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receive)


class ArchiveTests(unittest.TestCase):
    def test_assets_keep_three_generations_without_transitive_growth(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old = root / 'legacy'
            (old / 'web/_app/immutable').mkdir(parents=True)
            (old / 'web/_app/immutable/legacy.js').write_text('legacy')
            for index in range(5):
                new = root / str(index)
                assets = new / 'web/_app/immutable'
                assets.mkdir(parents=True)
                (assets / (str(index) + '.js')).write_text(str(index))
                receive.carry_assets(new, old)
                expected = {str(i) + '.js' for i in range(max(0, index - 2), index + 1)}
                if index < 2:
                    expected.add('legacy.js')
                self.assertEqual({p.name for p in assets.iterdir()}, expected)
                old = new

    def test_unchanged_assets_do_not_age_out_compatibility(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old = root / 'old'
            (old / 'web/_app/immutable').mkdir(parents=True)
            (old / 'web/_app/immutable/old.js').write_text('old')
            for index in range(5):
                new = root / str(index)
                (new / 'web/_app/immutable').mkdir(parents=True)
                (new / 'web/_app/immutable/current.js').write_text('current')
                receive.carry_assets(new, old)
                self.assertTrue((new / 'web/_app/immutable/old.js').exists())
                old = new

    def test_asset_manifest_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            new, old = root / 'new', root / 'old'
            for release in (new, old):
                (release / 'web/_app/immutable').mkdir(parents=True)
            (old / 'asset-generations.json').write_text(json.dumps([['../secret']]))
            with self.assertRaises(ValueError):
                receive.carry_assets(new, old)

    def test_asset_collision_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old, new = root / 'old', root / 'new'
            for release, content in ((old, 'old'), (new, 'new')):
                (release / 'web/_app/immutable').mkdir(parents=True)
                (release / 'web/_app/immutable/same.js').write_text(content)
            with self.assertRaises(ValueError):
                receive.carry_assets(new, old)

    def archive(self, extra=None):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            files = {'release.json': json.dumps({'commit': 'a' * 40}).encode(), 'web/200.html': b'hello', 'backend/pocketbase': b'ELF'}
            for name, data in files.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
            if extra:
                archive.addfile(extra)
        stream.seek(0)
        return tarfile.open(fileobj=stream, mode='r:gz')

    def test_valid(self):
        with self.archive() as archive:
            self.assertEqual(receive.validate(archive)['commit'], 'a' * 40)

    def test_root_script_rejected(self):
        with self.archive(tarfile.TarInfo('deploy/evil.sh')) as archive:
            with self.assertRaises(ValueError):
                receive.validate(archive)

    def test_unsafe_paths_and_links(self):
        for path in ['../escape', '/etc/passwd', 'web/../escape', 'backend/pocketbase', 'web//duplicate']:
            with self.subTest(path=path), self.archive(tarfile.TarInfo(path)) as archive:
                with self.assertRaises(ValueError):
                    receive.validate(archive)
        link = tarfile.TarInfo('web/link')
        link.type = tarfile.SYMTYPE
        link.linkname = '/etc'
        with self.archive(link) as archive:
            with self.assertRaises(ValueError):
                receive.validate(archive)

    def test_duplicate_rejected(self):
        with self.archive(tarfile.TarInfo('web/200.html')) as archive:
            with self.assertRaises(ValueError):
                receive.validate(archive)

    def test_failed_startup_restores_code_and_data_before_reopening(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            old, new, data, marker = root / 'old', root / 'new', root / 'data', root / 'maintenance'
            old.mkdir()
            new.mkdir()
            data.mkdir()
            (data / 'data.db').write_text('original database')
            (root / 'current').symlink_to(old)
            calls = []
            def health():
                self.assertEqual(marker.stat().st_mode & 0o777, 0o644)
                calls.append(1)
                if len(calls) == 1:
                    (data / 'data.db').write_text('failed migration')
                    raise RuntimeError('failed startup')
            with patch.multiple(receive, ROOT=root, DATA=data, MARKER=marker), patch.object(receive, 'run'), patch.object(receive, 'health', side_effect=health), patch.object(receive.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('', 503, '', {}, None)):
                previous_umask = os.umask(0o077)
                try:
                    with self.assertRaisesRegex(RuntimeError, 'failed startup'):
                        receive.activate(new, old, 'a' * 40)
                finally:
                    os.umask(previous_umask)
            self.assertEqual((root / 'current').resolve(), old.resolve())
            self.assertEqual((data / 'data.db').read_text(), 'original database')
            self.assertFalse(marker.exists())
            self.assertEqual((root / ('failed-data-' + 'a' * 40) / 'data.db').read_text(), 'failed migration')


if __name__ == '__main__':
    unittest.main()
