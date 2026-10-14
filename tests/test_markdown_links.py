"""Regression tests for the CI Markdown file link check."""

from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CHECKER = Path(__file__).resolve().parents[1] / ".github/scripts/check_markdown_links.py"


class MarkdownLinksTest(unittest.TestCase):
    def check(self, text, targets=()):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "docs" / "source.md"
            source.parent.mkdir()
            source.write_text(text, encoding="utf-8")
            for target in targets:
                path = root / target
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            return subprocess.run(
                [sys.executable, str(CHECKER), str(source)],
                capture_output=True, text=True, check=False,
            )

    def test_resolves_links_relative_to_document(self):
        result = self.check(
            "[sibling](next.md#section) [parent](../README.md) [folder](../docs/)",
            ["docs/next.md", "README.md"],
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_relative_file_fails_cli(self):
        result = self.check("[missing](missing.md#section)")
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing link target: missing.md#section", result.stderr)

    def test_reference_links_and_images_are_checked(self):
        result = self.check("[reference][guide]\n\n[guide]: ../absent.md\n\n![image](missing.png)")
        self.assertEqual(result.returncode, 1)
        self.assertIn("../absent.md", result.stderr)
        self.assertIn("missing.png", result.stderr)

    def test_code_urls_and_fragments_are_ignored(self):
        result = self.check(
            "```md\n[example](missing.md)\n```\n\n`[example](missing.md)`\n\n"
            "[web](https://example.com/no-file) [mail](mailto:a@example.com) "
            "[cdn](//example.com/file) [section](#section)"
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_encoded_paths_and_link_titles(self):
        result = self.check('[guide](a%20guide.md "Guide")', ["docs/a guide.md"])
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_repository_root_relative_link(self):
        result = self.check("[skill](/SKILL.md)")
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
