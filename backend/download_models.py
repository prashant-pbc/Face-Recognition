#!/usr/bin/env python3
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.config import MODEL_DIR, MODEL_URLS  # noqa: E402


def fetch(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "liveface/1.0"})
    with urllib.request.urlopen(req, timeout=90) as resp, open(tmp, "wb") as fh:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            fh.write(chunk)
    tmp.replace(dest)


def main() -> int:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for name, urls in MODEL_URLS.items():
        dest = MODEL_DIR / name
        if dest.exists() and dest.stat().st_size > 50_000:
            print(f"ok {name}")
            continue
        last_err = None
        for url in urls:
            try:
                print(f"download {name} <- {url}")
                fetch(url, dest)
                if dest.exists() and dest.stat().st_size > 50_000:
                    print(f"saved {name} ({dest.stat().st_size} bytes)")
                    last_err = None
                    break
            except Exception as exc:
                last_err = exc
                print(f"  fail: {exc}")
        if last_err is not None and (not dest.exists() or dest.stat().st_size <= 50_000):
            failed.append(name)
    if failed:
        print("missing:", ", ".join(failed))
        return 1
    print("all models ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
