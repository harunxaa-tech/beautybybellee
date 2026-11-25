#!/usr/bin/env python3
"""Dependency-free static release checks. No credentials, no deployment."""
import json
import re
import subprocess
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = 0

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.assets, self.meta, self.titles = [], {}, 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"):
            self.assets.append(a["src"])
        if tag == "link" and a.get("href") and set(a.get("rel", "").split()) & {"stylesheet", "icon", "manifest", "apple-touch-icon"}:
            self.assets.append(a["href"])
        if tag == "meta" and a.get("name"):
            self.meta.setdefault(a["name"].lower(), []).append(a.get("content", ""))
        if tag == "title":
            self.titles += 1

def page(path, preview=False):
    p = Page()
    p.feed(path.read_text(encoding="utf-8"))
    check(p.titles == 1, f"{path.relative_to(ROOT)}: expected one title")
    check(len(p.meta.get("description", [])) == 1, f"{path.relative_to(ROOT)}: expected one description")
    if preview:
        check(any("noindex" in v.lower().split(",") for v in p.meta.get("robots", [])), f"{path.relative_to(ROOT)}: preview indexing protection missing")
    for src in p.assets:
        u = urlsplit(src)
        if u.scheme or u.netloc or not u.path:
            continue
        target = ROOT / unquote(u.path.lstrip("/")) if u.path.startswith("/") else path.parent / unquote(u.path)
        check(target.is_file(), f"{path.relative_to(ROOT)}: missing local asset {src}")

for name in ["index.html", "marketing/index.html", "angebotspilot/index.html", "account-deletion.html"]:
    p = ROOT / name
    check(p.is_file(), f"Missing {name}")
    if p.is_file():
        page(p, preview=name in {"marketing/index.html", "angebotspilot/index.html"})

for p in sorted(ROOT.rglob("*")):
    if not p.is_file() or any(part in {".git", "node_modules", "www"} for part in p.relative_to(ROOT).parts):
        continue
    if p.suffix in {".js", ".mjs"}:
        r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
        check(r.returncode == 0, f"JavaScript syntax: {p.relative_to(ROOT)}: {r.stderr.strip()[:300]}")
    if p.suffix == ".json":
        try:
            json.loads(p.read_text(encoding="utf-8"))
            check(True, "")
        except (ValueError, UnicodeError):
            check(False, f"Invalid JSON: {p.relative_to(ROOT)}")

archive = ROOT / "AngebotsPilot-Native-Source-v0.6.0.zip"
check(archive.is_file(), "Native source archive missing")
if archive.is_file():
    with zipfile.ZipFile(archive) as z:
        check(z.testzip() is None, "Native archive failed CRC validation")
        names = set(z.namelist())
        for n in ["native/package.json", "native/capacitor.config.json", "native/scripts/prepare-web.mjs", "native/scripts/patch-ios.mjs", "native/scripts/release-preflight.mjs", "native/privacy/PrivacyInfo.xcprivacy", "native/assets/AppIcon-1024.png"]:
            check(n in names, f"Native archive missing {n}")
        if "native/package.json" in names and "native/capacitor.config.json" in names:
            package = json.loads(z.read("native/package.json"))
            config = json.loads(z.read("native/capacitor.config.json"))
            check(package.get("version") == "0.6.0", "Unexpected native archive version")
            check(config.get("appId") == "com.harunxaa.angebotspilot", "Unexpected iOS bundle ID")
            for cmd in ["validate", "release:preflight", "prepare:web", "prepare:ios"]:
                check(cmd in package.get("scripts", {}), f"Native npm script missing: {cmd}")
        for name in sorted(names):
            if name.endswith((".js", ".mjs")):
                mode = "module" if name.endswith(".mjs") else "commonjs"
                r = subprocess.run(["node", "--check", "--input-type=" + mode], input=z.read(name), capture_output=True)
                check(r.returncode == 0, f"Native JS syntax: {name}: {r.stderr.decode(errors='replace')[:300]}")
        workflow = (ROOT / "codemagic.yaml").read_text(encoding="utf-8")
        check(archive.name in workflow, "Codemagic references a different source archive")
        check(not re.search(r"(?m)^\s*submit_to_app_store:\s*true\s*$", workflow), "Automatic production submission is enabled")
        check(not re.search(r"(?m)^\s*submit_to_testflight:\s*true\s*$", workflow), "Automatic TestFlight submission is enabled")

print(f"{checks} static checks; {len(errors)} failures")
for error in errors:
    print("FAIL:", error)
sys.exit(bool(errors))
