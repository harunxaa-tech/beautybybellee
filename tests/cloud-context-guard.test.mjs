import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const marker='  globalThis.CloudSync=';
const hook='  globalThis.testConnect=(c,s,co,m)=>{client=c;session=s;company=co;membership=m;contextGeneration++}; globalThis.testReadContext=readContext;globalThis.testAssertSafePull=assertSafePull;globalThis.testUpsert=upsertRows;\n';
function fixture(){
 const workspace={meta:{cloudCompanyId:'a',authUserId:'u',localRevision:1}};
 const calls=[];let resolve;
 const client={from(table){calls.push(table);return {upsert(){return this},select(){return new Promise(r=>{resolve=r})}}}};
 const session={user:{id:'u'}},company={id:'a'},membership={role:'owner'};
 const context=vm.createContext({data:workspace,document:{getElementById(){return null}},structuredClone});
 vm.runInContext(src.replace(marker,hook+marker),context);
 context.testConnect(client,session,company,membership);
 return {context,workspace,calls,client,session,company,membership,finish:()=>resolve({data:[]})};
}
test('workspace replacement invalidates captured context',()=>{const f=fixture(),c=f.context.testReadContext();f.context.data={...f.workspace};assert.throws(()=>c.assert(),/Arbeitsbereich/)});
test('same identity after detach and reattach invalidates old work',()=>{const f=fixture(),c=f.context.testReadContext();f.context.CloudSync.detach();f.context.testConnect(f.client,f.session,f.company,f.membership);assert.throws(()=>c.assert(),/Arbeitsbereich/)});
test('actual auth context switch stops old write even before attach',()=>{const f=fixture(),c=f.context.testReadContext();f.context.APCloudContext=()=>({client:f.client,session:f.session,company:{id:'b'},membership:f.membership});assert.throws(()=>c.assert(),/Arbeitsbereich/)});
test('pending local data blocks pull',()=>{const f=fixture(),c=f.context.testReadContext();f.workspace.meta.repositoryPushPending=true;assert.throws(()=>f.context.testAssertSafePull(c,1),/noch nicht bestätigt/)});
test('new local revision during pull blocks adoption',()=>{const f=fixture(),c=f.context.testReadContext();f.workspace.meta.localRevision=2;assert.throws(()=>f.context.testAssertSafePull(c,1),/während des Ladens/)});
test('matching clean revision allows pull',()=>{const f=fixture(),c=f.context.testReadContext();assert.doesNotThrow(()=>f.context.testAssertSafePull(c,1))});
test('wrong-company rows rejected before writing',async()=>{const f=fixture(),c=f.context.testReadContext();await assert.rejects(f.context.testUpsert(c,'customers',[{company_id:'b'}]),/Falscher Cloud-Betrieb/);assert.equal(f.calls.length,0)});
test('account change while database request runs cannot acknowledge or continue',async()=>{const f=fixture(),c=f.context.testReadContext();const pending=f.context.testUpsert(c,'customers',[{company_id:'a'}]);f.context.data={meta:{cloudCompanyId:'b',authUserId:'u'}};f.finish();await assert.rejects(pending,/Arbeitsbereich/);assert.equal(f.calls.length,1)});
test('manual refresh does not push full snapshot',()=>{const manual=src.slice(src.indexOf('  async function manual(){'),src.indexOf(marker));assert.doesNotMatch(manual,/await pushSnapshot/);assert.match(manual,/assertSafePull/);assert.match(manual,/await pullCloud/)});