"""Tests for the map extraction toolkit, using invented fixtures."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLKIT = os.path.dirname(HERE)
FIXTURES = os.path.join(HERE, "fixtures")


def run_py(script, *args):
    return subprocess.run([sys.executable, "-I", os.path.join(TOOLKIT, script), *args],
                          capture_output=True, text=True)


class ToolkitTest(unittest.TestCase):
    def test_validate_ok(self):
        r = run_py("validate_exports.py", os.path.join(FIXTURES, "v1"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("OK", r.stdout)

    def test_validate_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            copy = os.path.join(tmp, "v1")
            shutil.copytree(os.path.join(FIXTURES, "v1"), copy)
            os.remove(os.path.join(copy, "heroes.json"))
            r = run_py("validate_exports.py", copy)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("missing heroes.json", r.stdout)

    def test_diff_reports_change_and_addition(self):
        r = run_py("diff_exports.py", os.path.join(FIXTURES, "v1"), os.path.join(FIXTURES, "v2"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, r"~ H001.*str: 10 -> 12")
        self.assertIn("+ A002", r.stdout)

    def test_run_sh_usage(self):
        r = subprocess.run(["bash", os.path.join(TOOLKIT, "run.sh")], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("usage", r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
