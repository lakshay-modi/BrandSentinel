#!/usr/bin/env python3
"""Builds the files the Connect page offers for download: the browser extension as a zip, and the Google Docs
add-on as a zip plus plain-text copies (so its two files can be copied straight from the page).
Run from the repository root after changing extension/ or google-docs-addon/:  python3 scripts/pack-downloads.py"""
import os, shutil, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "downloads")
os.makedirs(os.path.join(OUT, "google-docs-addon"), exist_ok=True)

def pack(folder, name):
    path = os.path.join(OUT, name)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in sorted(os.walk(os.path.join(ROOT, folder))):
            for f in sorted(files):
                full = os.path.join(base, f)
                info = zipfile.ZipInfo(os.path.join(folder, os.path.relpath(full, os.path.join(ROOT, folder))), date_time=(2026, 11, 14, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(full, "rb") as fh:
                    z.writestr(info, fh.read())
    print(name, os.path.getsize(path), "bytes")

pack("extension", "brandsentinel-extension.zip")
pack("google-docs-addon", "brandsentinel-google-docs-addon.zip")
for f in ("Code.gs", "Sidebar.html", "appsscript.json"):
    shutil.copyfile(os.path.join(ROOT, "google-docs-addon", f), os.path.join(OUT, "google-docs-addon", f + ".txt"))
