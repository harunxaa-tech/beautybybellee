// Candidate build-tool update only. Do not publish or alter native runtime packages.
import fs from 'node:fs';
const path=process.argv[2];
if(!path)throw new Error('Native manifest path required');
const pkg=JSON.parse(fs.readFileSync(path,'utf8'));
if(pkg.name!=='angebotspilot-native'||pkg.version!=='0.6.0'||pkg.devDependencies?.['@capacitor/cli']!=='8.5.1')
  throw new Error('Unexpected source manifest; review before updating');
for(const name of ['@capacitor/core','@capacitor/ios','@capacitor/android']){
  if(pkg.dependencies?.[name]!=='8.5.1')throw new Error('Unexpected runtime version: '+name);
}
pkg.devDependencies['@capacitor/cli']='8.6.2';
fs.writeFileSync(path,JSON.stringify(pkg,null,2)+'\n');
console.log('Candidate: Capacitor CLI 8.5.1 -> 8.6.2; native runtimes unchanged.');
