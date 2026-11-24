"""The managed build wrapper must work after a file upload loses executable bits."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BootstrapTests(unittest.TestCase):
    def test_bash_wrapper_reenters_without_executable_script_bits(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / "scripts").mkdir()
            for name in ("build-verified.sh", "sites-env.sh"):
                target = project / "scripts" / name
                shutil.copyfile(ROOT / "scripts" / name, target)
                target.chmod(0o644)
            binary = project / "node_modules/.bin/vinext"
            binary.parent.mkdir(parents=True)
            binary.write_text('#!/bin/sh\ntest "$1" = "build"\n')
            binary.chmod(0o755)
            env = {k:v for k,v in os.environ.items() if not k.startswith("SITES_")}
            env["SITES_BUILD_TIMEOUT"] = "10s"
            result = subprocess.run(["bash", str(project / "scripts/build-verified.sh")],
                                    cwd=project, env=env, capture_output=True, text=True,
                                    timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("bounded vinext build", result.stdout)


if __name__ == '__main__':unittest.main()
