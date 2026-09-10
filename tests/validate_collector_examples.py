"""Validate the actual documented YAML using a pinned, network-isolated Collector.

Run from the repository root: python tests/validate_collector_examples.py
Docker must be available; validation does not test backend connectivity or delivery.
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "otel/opentelemetry-collector-contrib:0.160.0"
EXAMPLES = [
    ("references/ai-agents.md", "## 3. Unified Collector Config"),
    ("references/collector.md", "### Agent Configuration (Kafka Exporter)"),
    ("references/collector.md", "### Gateway Configuration (Kafka Receiver)"),
]


def main():
    for filename, heading in EXAMPLES:
        text = (ROOT / filename).read_text()
        section = text[text.index(heading):]
        config = re.search(r"```yaml\n(.*?)```", section, re.S).group(1)
        result = subprocess.run([
            "docker", "run", "--rm", "-i", "--network", "none",
            "--env", "KAFKA_USERNAME=example", "--env", "KAFKA_PASSWORD=example",
            IMAGE, "validate", "--config=file:/dev/stdin",
        ], input=config, text=True, capture_output=True, timeout=180)
        print(f"{filename}: {heading}: {'PASS' if result.returncode == 0 else 'FAIL'}", flush=True)
        if result.returncode:
            raise SystemExit(result.stdout + result.stderr)


if __name__ == "__main__":
    main()
