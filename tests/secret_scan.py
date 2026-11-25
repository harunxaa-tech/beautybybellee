#!/usr/bin/env python3
"""Targeted secret-pattern scan. Prints paths and categories only, never values."""
import base64
import json
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT = {".js",".mjs",".cjs",".ts",".tsx",".jsx",".json",".html",".css",".txt",".md",".sql",".xml",".plist",".yaml",".yml",".toml",".ini",".py",".sh",".swift",".kt",".java",".properties",".conf",".env",".xcprivacy"}
PATTERNS = {
    "Stripe secret": r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b",
    "Stripe webhook secret": r"\bwhsec_[A-Za-z0-9]{20,}\b",
    "OpenAI secret": r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b",
    "Supabase secret": r"\bsb_secret_[A-Za-z0-9_-]{20,}\b",
    "GitHub token": r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b",
    "Private key": r"-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{32,}",
    "AWS access key": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
}
JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{16,}\b")
COMPILED = {name: re.compile(pattern) for name,pattern in PATTERNS.items()}
MAX_TEXT = 16*1024*1024
MAX_ARCHIVE = 128*1024*1024

def findings(text):
    kinds = {name for name,p in COMPILED.items() if p.search(text)}
    for match in JWT.finditer(text):
        body = match.group(1)
        try:
            claims = json.loads(base64.urlsafe_b64decode(body + "="*(-len(body)%4)))
            if isinstance(claims,dict) and claims.get("role") == "service_role":
                kinds.add("Supabase service-role JWT")
        except (ValueError, UnicodeError):
            pass
    return kinds

def is_text(name):
    p=Path(name)
    return p.suffix.lower() in TEXT or p.name.startswith(".env") or p.name in {".npmrc",".gitignore"}

def scan_blob(blob,label):
    if len(blob)>MAX_TEXT:
        return [(label,"Text exceeds scan limit")]
    try:
        s=blob.decode("utf-8")
    except UnicodeError:
        return [(label,"Text could not be decoded")]
    return [(label,kind) for kind in sorted(findings(s))]

def scan_zip(path):
    result=[]
    with zipfile.ZipFile(path) as z:
        total=0
        for info in z.infolist():
            if info.is_dir():
                continue
            total+=info.file_size
            if total>MAX_ARCHIVE:
                return result+[(str(path.relative_to(ROOT)),"Archive exceeds scan limit")]
            if is_text(info.filename):
                label=str(path.relative_to(ROOT))+"!"+info.filename
                if info.file_size>MAX_TEXT:
                    result.append((label,"Text exceeds scan limit"))
                else:
                    result.extend(scan_blob(z.read(info),label))
            elif info.filename.lower().endswith((".p12",".pfx",".p8",".jks",".keystore",".pem",".key")):
                result.append((str(path.relative_to(ROOT))+"!"+info.filename,"Potential credential file"))
    return result

def main():
    paths=subprocess.check_output(["git","ls-files","-z"],cwd=ROOT).decode("utf-8").split("\0")
    issues=[]
    for name in filter(None,paths):
        if name=="tests/secret_scan.py" or name=="tests/secret_scan_test.py":
            continue
        path=ROOT/name
        if not path.is_file():
            continue
        if path.is_symlink():
            issues.append((name,"Tracked symlink requires review"))
        elif path.suffix.lower()==".zip":
            try:
                issues.extend(scan_zip(path))
            except (OSError,ValueError,RuntimeError,zipfile.BadZipFile):
                issues.append((name,"Archive scan failed"))
        elif path.suffix.lower() in {".p12",".pfx",".p8",".jks",".keystore",".pem",".key"}:
            issues.append((name,"Potential credential file"))
        elif is_text(name):
            issues.extend(scan_blob(path.read_bytes(),name) if path.stat().st_size<=MAX_TEXT else [(name,"Text exceeds scan limit")])
    for path,category in issues:
        print("REVIEW:",repr(path),category)
    print(f"Tracked working-tree scan: {len(issues)} findings. Values redacted.")
    return bool(issues)

if __name__=="__main__":
    raise SystemExit(main())
