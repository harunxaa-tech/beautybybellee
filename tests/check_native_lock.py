#!/usr/bin/env python3
"""Require registry-only integrity-pinned package lock. Candidate still needs review."""
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
p=Path(sys.argv[1])
lock=json.loads(p.read_text(encoding="utf-8"))
packages=lock.get("packages",{})
if lock.get("lockfileVersion")!=3 or not isinstance(packages,dict) or "" not in packages or len(packages)<2:
    raise SystemExit("Unexpected npm lock format")
errors=[]
for name,entry in packages.items():
    if not name:
        continue
    resolved=urlsplit(entry.get("resolved",""))
    if resolved.scheme!="https" or resolved.hostname!="registry.npmjs.org" or resolved.username or resolved.password or resolved.port or not entry.get("integrity","").startswith("sha512-") or entry.get("link"):
        errors.append(name)
if errors:
    for name in errors: print("REVIEW dependency:",repr(name))
    raise SystemExit("Dependency source/integrity policy failed")
print(f"{len(packages)-1} locked packages with registry source and SHA-512 integrity.")
