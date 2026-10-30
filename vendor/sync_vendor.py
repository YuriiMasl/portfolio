"""Copy the existing local GSAP distribution without downloads or installs."""
from hashlib import sha256
from pathlib import Path


def main():
    destination = Path(__file__).resolve().parent
    source = destination.parents[1] / "site_lyublyu" / "vendor"
    names = ("gsap.min.js", "ScrollTrigger.min.js")
    files = []
    for name in names:
        original = source / name
        target = destination / name
        data = original.read_bytes()
        if not data or b"3.13.0" not in data[:200]:
            raise SystemExit(f"FAIL: unexpected source version or empty file: {original}")
        if target.exists() and target.read_bytes() != data:
            raise SystemExit(f"FAIL: refusing to replace a different file: {target}")
        files.append((name, target, data))
    for name, target, data in files:
        if not target.exists():
            target.write_bytes(data)
        copied = target.read_bytes()
        if copied != data:
            raise SystemExit(f"FAIL: copy differs: {target}")
        print(f"PASS {name}: {len(copied)} bytes; SHA256 {sha256(copied).hexdigest()}")
    print("PASS: local vendor copies match source bytes; license headers preserved.")
    print("NOT CHECKED: JavaScript execution, HTTP loading, Chrome visual acceptance.")


if __name__ == "__main__":
    main()
