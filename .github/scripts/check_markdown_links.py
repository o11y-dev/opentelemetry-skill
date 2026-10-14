"""Check local file destinations in tracked Markdown; skip URLs and fragments."""

from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote, urlsplit

from markdown_it import MarkdownIt


ROOT = Path(__file__).resolve().parents[2]


def broken_links(path: Path) -> list[str]:
    tokens = MarkdownIt().parse(path.read_text(encoding="utf-8"))
    errors = []
    while tokens:
        token = tokens.pop()
        tokens.extend(token.children or [])
        destination = token.attrGet("href") or token.attrGet("src")
        if not destination:
            continue
        url = urlsplit(destination)
        if url.scheme or url.netloc or not url.path:
            continue
        decoded = unquote(url.path)
        target = ROOT / decoded.lstrip("/") if decoded.startswith("/") else path.parent / decoded
        if not target.exists():
            errors.append(f"{path}: missing link target: {destination}")
    return sorted(errors)


def main() -> int:
    paths = [Path(arg) for arg in sys.argv[1:]] if len(sys.argv) > 1 else [
        ROOT / name
        for name in subprocess.check_output(
            ["git", "ls-files", "-z", "--", "*.md"], cwd=ROOT
        ).decode().split("\0") if name
    ]
    errors = []
    for path in paths:
        try:
            errors.extend(broken_links(path))
        except (OSError, ValueError) as exc:
            errors.append(f"{path}: {exc}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Checked local file links in {len(paths)} Markdown files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
