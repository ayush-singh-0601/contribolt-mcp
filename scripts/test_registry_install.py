"""Check propagation retries without publishing or making network requests."""
import subprocess
import unittest
from unittest.mock import Mock

from registry_install import install_public


class RegistryInstallTests(unittest.TestCase):
    def test_retries_version_not_found_and_succeeds(self):
        clock = [0]
        run = Mock(side_effect=[subprocess.CompletedProcess([], 1, "", "npm error ETARGET"),
                                subprocess.CompletedProcess([], 0, "installed\n", "")])
        install_public(["npm", "install"], cwd=".", env={}, deadline=30, run=run,
                       now=lambda: clock[0], sleep=lambda seconds: clock.__setitem__(0, clock[0] + seconds))
        self.assertEqual(run.call_count, 2)
        self.assertEqual(clock[0], 10)

    def test_does_not_retry_authentication_failure(self):
        run = Mock(return_value=subprocess.CompletedProcess([], 1, "", "npm error E401"))
        with self.assertRaises(subprocess.CalledProcessError):
            install_public(["npm", "install"], cwd=".", env={}, deadline=30, run=run, now=lambda: 0)
        self.assertEqual(run.call_count, 1)

    def test_propagation_wait_is_bounded(self):
        clock = [0]
        run = Mock(return_value=subprocess.CompletedProcess([], 1, "", "npm error ETARGET"))
        with self.assertRaises(TimeoutError):
            install_public(["npm", "install"], cwd=".", env={}, deadline=5, run=run,
                           now=lambda: clock[0], sleep=lambda seconds: clock.__setitem__(0, clock[0] + seconds))
        self.assertEqual(run.call_count, 1)
        self.assertEqual(clock[0], 5)


if __name__ == "__main__":
    unittest.main()
