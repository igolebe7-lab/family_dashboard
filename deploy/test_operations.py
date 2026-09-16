import importlib.util
import tempfile
import tarfile
from unittest.mock import patch
import unittest
from pathlib import Path


def module(name):
    spec = importlib.util.spec_from_file_location(name, 'deploy/' + name + '.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class OperationsTests(unittest.TestCase):
    def test_retention_keeps_current_previous_and_three_latest(self):
        prune = module('prune_releases')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            releases = root / 'releases'
            releases.mkdir()
            paths = []
            for i in range(7):
                path = releases / ('familytime-ci-' + str(i) * 40)
                path.mkdir()
                paths.append(path)
            (root / 'current').symlink_to(paths[0])
            (root / 'previous').symlink_to(paths[1])
            (releases / 'operator-notes').mkdir()
            (root / 'outside').mkdir()
            (releases / ('familytime-ci-' + 'a' * 40)).symlink_to(root / 'outside')
            result = prune.candidates(root)
            self.assertEqual(len(result), 2)
            self.assertNotIn(paths[0], result)
            self.assertNotIn(paths[1], result)
            self.assertTrue(all(p in paths for p in result))

    def test_retention_refuses_missing_previous(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(RuntimeError):
                module('prune_releases').candidates(Path(temp))

    def test_backup_metadata_validation(self):
        pull = module('mac_backup')
        valid = {'name': 'familytime-20260915T200610Z.tar.gz', 'sha256': 'a' * 64,
                 'size': 1024, 'mtime': 1000}
        pull.validate_metadata(valid)
        for key, value in [('name', '../secret'), ('sha256', 'bad'), ('size', -1)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                pull.validate_metadata({**valid, key: value})

    def test_certificate_threshold_for_short_lived_ip_certificate(self):
        monitor = module('monitor')
        self.assertEqual(monitor.certificate_problem(0, 6 * 86400, 4 * 86400), None)
        self.assertIsNotNone(monitor.certificate_problem(0, 6 * 86400, 5.5 * 86400))
        self.assertIsNotNone(monitor.certificate_problem(0, 6 * 86400, 7 * 86400))

    def test_incident_deduplication_and_recovery(self):
        action = module('monitor_incident').action
        self.assertEqual(action(False, False), 'create')
        self.assertEqual(action(False, True), 'none')
        self.assertEqual(action(True, True), 'close')
        self.assertEqual(action(True, False), 'none')

    def test_manual_notification_is_separate_from_real_incident(self):
        incident = module('monitor_incident')
        env = {'NOTIFICATION_TEST': 'true', 'HEALTH': 'success', 'OWNER': 'owner', 'RUN_URL': 'https://example.test/run'}
        with patch.dict('os.environ', env), patch.object(incident.subprocess, 'check_output', return_value=b'[]'), patch.object(incident.subprocess, 'run') as run:
            incident.main()
            self.assertEqual(run.call_count, 1)
            command = run.call_args.args[0]
            self.assertIn('[TEST 14.12.2]', command[command.index('--title') + 1])
            self.assertIn('NOT reported down', command[command.index('--body') + 1])

    def test_recovery_rejects_unsafe_archive(self):
        allowed = module('recovery_drill').allowed
        self.assertTrue(allowed(tarfile.TarInfo('var/lib/familytime/pb_data/data.db')))
        for path in ('/etc/passwd', '../escape', 'var/lib/familytime/pb_data/../escape'):
            self.assertFalse(allowed(tarfile.TarInfo(path)))
        link = tarfile.TarInfo('var/lib/familytime/pb_data/link')
        link.type = tarfile.SYMTYPE
        self.assertFalse(allowed(link))


if __name__ == '__main__':
    unittest.main()
