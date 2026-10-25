"""Write a controlled regression fixture into a new or empty directory."""
import argparse
import json
from pathlib import Path

fixtures = json.loads(Path(__file__).with_name("dry-run-fixtures.json").read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("ecosystem", choices=[fixture["ecosystem"] for fixture in fixtures])
parser.add_argument("destination", type=Path)
parser.add_argument("--fixed", action="store_true")
args = parser.parse_args()
target = args.destination.resolve()
if target.exists() and any(target.iterdir()):
    parser.error("destination must be new or empty; existing work will not be overwritten")
target.mkdir(parents=True, exist_ok=True)
fixture = next(item for item in fixtures if item["ecosystem"] == args.ecosystem)
files = {**fixture["files"], **(fixture["fix"] if args.fixed else {})}
for name, text in files.items():
    path = (target / name).resolve()
    if not path.is_relative_to(target):
        raise ValueError("fixture path escapes destination")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
print(f"Created {args.ecosystem} {'corrected' if args.fixed else 'failing baseline'} fixture in {target}")
