#!/usr/bin/env python3
"""Convert visual files to PNG screenshots for vision verification.

Usage: python screenshot.py <input_file>
Output: /sandbox/output/screenshot.png
"""
import sys
import os
import subprocess
from pathlib import Path

OUTPUT_PATH = "/sandbox/output/screenshot.png"


def screenshot_html(input_path: str) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(f"file://{input_path}")
        page.wait_for_timeout(1500)
        page.screenshot(path=OUTPUT_PATH, full_page=True)
        browser.close()


def screenshot_pptx(input_path: str) -> None:
    tmpdir = "/tmp/pptx_convert"
    os.makedirs(tmpdir, exist_ok=True)
    subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            tmpdir,
            input_path,
        ],
        check=True,
        timeout=30,
    )
    pdf_path = Path(tmpdir) / (Path(input_path).stem + ".pdf")
    screenshot_pdf(str(pdf_path))


def screenshot_pdf(input_path: str) -> None:
    subprocess.run(
        ["pdftoppm", "-png", "-f", "1", "-l", "1", "-r", "150", input_path, "/tmp/page"],
        check=True,
        timeout=15,
    )
    # pdftoppm outputs /tmp/page-1.png (or /tmp/page-01.png depending on page count)
    for candidate in ["/tmp/page-1.png", "/tmp/page-01.png", "/tmp/page-001.png"]:
        if os.path.exists(candidate):
            os.rename(candidate, OUTPUT_PATH)
            return
    raise FileNotFoundError("pdftoppm did not produce expected output file")


def screenshot_svg(input_path: str) -> None:
    import cairosvg

    cairosvg.svg2png(url=input_path, write_to=OUTPUT_PATH, output_width=1280)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: screenshot.py <input_file>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    ext = Path(input_path).suffix.lower()

    os.makedirs("/sandbox/output", exist_ok=True)

    handlers = {
        ".html": screenshot_html,
        ".htm": screenshot_html,
        ".pptx": screenshot_pptx,
        ".pdf": screenshot_pdf,
        ".svg": screenshot_svg,
    }

    handler = handlers.get(ext)
    if handler is None:
        print(f"Unsupported file type: {ext}", file=sys.stderr)
        sys.exit(1)

    handler(input_path)
    print(f"Screenshot saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
