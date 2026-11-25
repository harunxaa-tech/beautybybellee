import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../data-repository.js',import.meta.url),'utf8');
const KEY='digitaler_handwerker_v3';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(){
  const map=new Map();let id=0;
  const localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const ctx=vm.createContext({localStorage,structuredClone,crypto:{randomUUID:()=>String(++id)},console:{warn(){}}});
  vm.runInContext(src,ctx);
  const d={meta:{companyId:'a',currentUserId:'u',cloudCompanyId:'a',authUserId:'u'},settings:{companyName:'A'},customers:[]};
  ctx.data=d;const api=ctx.AppRepository;api.save(d);
  return{ctx,api,d,map,read:()=>JSON.parse(map.get(KEY))};
}
test('normal cloud success clears pending status',async()=>{const {api,d,read}=fixture();api.setCloudAdapter({pushSnapshot:async()=>({})});d.customers.push({id:'1',name:'Example'});api.save(d);assert.equal(read().meta.repositoryPushPending,true);await flush();assert.equal(read().meta.repositoryPushPending,false)});
test('deferred sync is not reported as completed',async()=>{const {api,d,read}=fixture();api.setCloudAdapter({pushSnapshot:async()=>({deferred:true})});d.customers.push({id:'1',name:'Example'});api.save(d);await flush();assert.equal(read().meta.repositoryPushPending,true);assert.equal(read().meta.lastCloudPushAt,undefined)});
test('failed sync remains pending and unchanged save retries',async()=>{const {api,d,read}=fixture();let calls=0;api.setCloudAdapter({pushSnapshot:async()=>{if(++calls===1)throw Error('offline')}});d.customers.push({id:'1',name:'Example'});api.save(d);await flush();assert.equal(read().meta.lastSyncError,'offline');assert.equal(read().meta.repositoryPushPending,true);api.save(d);await flush();assert.equal(calls,2);assert.equal(read().meta.repositoryPushPending,false)});
test('late success cannot overwrite another workspace',async()=>{const {api,d,ctx,read}=fixture();const gate=deferred();api.setCloudAdapter({pushSnapshot:()=>gate.promise});d.customers.push({id:'1',name:'old'});api.save(d);await flush();api.setCloudAdapter(null);ctx.data={meta:{companyId:'b',currentUserId:'v',cloudCompanyId:'b',authUserId:'v'},settings:{companyName:'B'},customers:[]};api.save(ctx.data);gate.resolve({});await flush();assert.equal(read().settings.companyName,'B')});
test('late rejection cannot resurrect cleared workspace',async()=>{const {api,d,map}=fixture();const gate=deferred();api.setCloudAdapter({pushSnapshot:()=>gate.promise});d.customers.push({id:'1',name:'old'});api.save(d);await flush();api.clear();gate.reject(Error('offline'));await flush();assert.equal(map.has(KEY),false)});
test('older response cannot mark newer revision as synchronized',async()=>{const {api,d,read}=fixture();const a=deferred(),b=deferred();let calls=0;api.setCloudAdapter({pushSnapshot:()=>++calls===1?a.promise:b.promise});d.customers.push({id:'1',name:'first'});api.save(d);await flush();d.customers[0].name='second';api.save(d);await flush();a.resolve({});await flush();assert.equal(read().meta.repositoryPushPending,true);assert.equal(read().customers[0].name,'second');b.resolve({});await flush();assert.equal(read().meta.repositoryPushPending,false)});
