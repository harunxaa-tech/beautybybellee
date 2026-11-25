import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../backup-preview.js',import.meta.url),'utf8');
const ctx=vm.createContext({structuredClone});
vm.runInContext(source,ctx);
const api=ctx.APBackupPreview;
function fixture(){const d={meta:{cloudCompanyId:'c',authUserId:'u'},settings:{password:'not-exported'},privacy:{role:'owner'},users:[{id:'u'}],customers:[{id:'a',name:'Test'}],offers:[],events:[],tasks:[],jobs:[],invoices:[],catalog:[]};const c={company:{id:'c'},session:{user:{id:'u'}},membership:{role:'owner'}};return {d,c}}
test('snapshot is explicitly partial and excludes account/settings data',()=>{const {d,c}=fixture();const s=api.makeSnapshot(d,c);assert.equal(s.complete,false);assert.equal(s.records.customers.length,1);assert.equal(s.settings,undefined);assert.equal(s.records.settings,undefined);assert.equal(s.records.users,undefined);assert.equal(s.records.privacy,undefined);s.records.customers[0].name='Changed';assert.equal(d.customers[0].name,'Test')});
test('worker cannot export even with forged local owner role',()=>{const {d,c}=fixture();c.membership.role='worker';assert.throws(()=>api.makeSnapshot(d,c),/Betriebsinhaber/)});
test('missing authenticated context fails closed',()=>{const {d}=fixture();assert.throws(()=>api.makeSnapshot(d,null),/Betriebsinhaber/)});
test('mismatched local workspace cannot export',()=>{const {d,c}=fixture();d.meta.authUserId='other';assert.throws(()=>api.makeSnapshot(d,c),/Betriebsinhaber/)});
test('preview never modifies workspace or authorizes restore',()=>{const {d,c}=fixture();const snap=api.makeSnapshot(d,c);snap.records.customers[0].name='Other';const before=JSON.stringify(d);const p=api.inspect(snap,d,c);assert.equal(p.restoreAllowed,false);assert.equal(p.found.customers,1);assert.equal(JSON.stringify(d),before)});
test('foreign-company backup rejected',()=>{const {d,c}=fixture();const s=api.makeSnapshot(d,c);s.scope.companyId='other';assert.throws(()=>api.inspect(s,d,c),/aktiven Betrieb/)});
test('foreign-user and unidentified legacy backup rejected',()=>{const {d,c}=fixture();const s=api.makeSnapshot(d,c);s.scope.userId='other';assert.throws(()=>api.inspect(s,d,c),/aktiven Betrieb/);assert.throws(()=>api.inspect({...d,meta:{}},d,c),/aktiven Betrieb/)});
test('duplicate IDs rejected',()=>{const {d,c}=fixture();const s=api.makeSnapshot(d,c);s.records.customers.push({id:'a'});assert.throws(()=>api.inspect(s,d,c),/doppelte/)});
test('missing collection and unsupported version rejected',()=>{const {d,c}=fixture();const s=api.makeSnapshot(d,c);delete s.records.jobs;assert.throws(()=>api.inspect(s,d,c),/Sammlung/);s.version=2;assert.throws(()=>api.inspect(s,d,c),/Sicherungsversion/)});
test('active app loads preview and legacy import does not overwrite workspace',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const script=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');const sw=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');assert.match(html,/backup-preview\.js/);assert.match(sw,/backup-preview\.js/);assert.doesNotMatch(html,/src="data-safety\.js/);const block=script.slice(script.indexOf('async function importBackup(ev)'),script.indexOf('function resetApp()',script.indexOf('async function importBackup(ev)')));assert.match(block,/api\.inspect/);assert.doesNotMatch(block,/globalThis\.data\s*=|saveData\(|pushSnapshot\(|pullCloud\(/)});
