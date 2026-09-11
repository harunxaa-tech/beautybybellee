import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nativeDir = path.resolve(here, '..');
const repoRoot = path.resolve(nativeDir, '..');
const outDir = path.join(nativeDir, 'www');

const allowedExtensions = new Set(['.html', '.css', '.js', '.json', '.svg']);
const ignoredRootFiles = new Set(['codemagic.yaml']);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const entries = await readdir(repoRoot, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  if (ignoredRootFiles.has(entry.name)) continue;
  const ext = path.extname(entry.name).toLowerCase();
  if (!allowedExtensions.has(ext)) continue;
  await cp(path.join(repoRoot, entry.name), path.join(outDir, entry.name));
}

const indexPath = path.join(outDir, 'index.html');
let html = await readFile(indexPath, 'utf8');

// Native builds do not use the PWA service worker. Keeping it active in WKWebView
// can create stale asset behavior and makes native updates harder to reason about.
html = html.replace(/<script>if\("serviceWorker" in navigator\)[\s\S]*?<\/script>/g, '');
html = html.replace(/<link\s+rel="manifest"[^>]*>/gi, '');
html = html.replace(
  '</head>',
  '<meta name="format-detection" content="telephone=no">\n' +
  '<script>window.__ANGEBOTSPILOT_NATIVE__=true;document.documentElement.classList.add("native-app");</script>\n' +
  '</head>'
);

await writeFile(indexPath, html, 'utf8');

const required = ['index.html', 'style.css', 'script.js', 'cloud-config.js', 'cloud-auth.js'];
for (const name of required) {
  try { await readFile(path.join(outDir, name)); }
  catch { throw new Error(`Native web bundle incomplete: ${name} fehlt.`); }
}

console.log(`Native web bundle ready: ${outDir}`);
