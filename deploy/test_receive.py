import importlib.util
import io
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
                calls.append(1)
                if len(calls) == 1:
                    (data / 'data.db').write_text('failed migration')
                    raise RuntimeError('failed startup')
            with patch.multiple(receive, ROOT=root, DATA=data, MARKER=marker), patch.object(receive, 'run'), patch.object(receive, 'health', side_effect=health), patch.object(receive.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('', 503, '', {}, None)):
                with self.assertRaisesRegex(RuntimeError, 'failed startup'):
                    receive.activate(new, old, 'a' * 40)
            self.assertEqual((root / 'current').resolve(), old.resolve())
            self.assertEqual((data / 'data.db').read_text(), 'original database')
            self.assertFalse(marker.exists())
            self.assertEqual((root / ('failed-data-' + 'a' * 40) / 'data.db').read_text(), 'failed migration')


if __name__ == '__main__':
    unittest.main()
