import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nativeDir = path.resolve(here, '..');
const config = JSON.parse(await readFile(path.join(nativeDir, 'capacitor.config.json'), 'utf8'));
const iosRoot = path.join(nativeDir, 'ios', 'App');
const pbxPath = path.join(iosRoot, 'App.xcodeproj', 'project.pbxproj');
const plistPath = path.join(iosRoot, 'App', 'Info.plist');

let pbx = await readFile(pbxPath, 'utf8');
pbx = pbx.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${config.appId};`);
pbx = pbx.replace(/TARGETED_DEVICE_FAMILY = "1,2";/g, 'TARGETED_DEVICE_FAMILY = 1;');
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 0.1.0;');
const buildNumber = process.env.CM_BUILD_NUMBER || '1';
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
await writeFile(pbxPath, pbx, 'utf8');

let plist = await readFile(plistPath, 'utf8');
plist = plist.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
  '<key>CFBundleDisplayName</key>\n\t<string>AngebotsPilot</string>'
);
plist = plist.replace(
  /<key>UISupportedInterfaceOrientations<\/key>\s*<array>[\s\S]*?<\/array>/,
  '<key>UISupportedInterfaceOrientations</key>\n\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>'
);
await writeFile(plistPath, plist, 'utf8');

const assets = path.join(nativeDir, 'assets');
const appAssets = path.join(iosRoot, 'App', 'Assets.xcassets');
await copyFile(path.join(assets, 'AppIcon-1024.png'), path.join(appAssets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'));
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await copyFile(path.join(assets, 'Splash-2732.png'), path.join(appAssets, 'Splash.imageset', name));
}

console.log(`iOS project patched for ${config.appId}, build ${buildNumber}.`);
