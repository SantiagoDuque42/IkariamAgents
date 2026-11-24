"""Validate data-store files against the schemas in schemas/.

Usage: python3 tools/validate.py <file.json> [...]
The schema is chosen from each file's own "schema" field. Exit code 1 if any file fails.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = {p.name: json.loads(p.read_text()) for p in (ROOT / "schemas").glob("*.json")}
REGISTRY = Registry().with_resources(
    (name, Resource.from_contents(s)) for name, s in SCHEMAS.items()
)


def validate(path: Path) -> list[str]:
    doc = json.loads(path.read_text())
    name = f"{doc.get('schema', '')}.json"
    if name not in SCHEMAS:
        return [f"unknown schema {doc.get('schema')!r}"]
    v = Draft202012Validator(SCHEMAS[name], registry=REGISTRY, format_checker=FormatChecker())
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in v.iter_errors(doc)]


def main(paths: list[str]) -> int:
    bad = 0
    for p in paths:
        errs = validate(Path(p))
        print(f"{'FAIL' if errs else 'ok  '} {p}")
        for e in errs[:20]:
            print("     ", e)
        bad += bool(errs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
