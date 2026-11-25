import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const marker='  globalThis.CloudSync=';
assert.equal(source.split(marker).length,2);
const ctx=vm.createContext({});
vm.runInContext(source.replace(marker,'  globalThis.testReadPaged=readPaged;\n  globalThis.testChildRows=childRows;\n'+marker),ctx);
const rows=Array.from({length:1251},(_,i)=>({id:String(i+1).padStart(6,'0')}));
function query(data,cap=500,hook=()=>{}){
  let cursor=null,limit=500;
  return {order(k,o){assert.equal(k,'id');assert.equal(o.ascending,true);return this},limit(n){limit=n;return this},gt(k,v){assert.equal(k,'id');cursor=v;return this},then(resolve,reject){return Promise.resolve().then(()=>{hook();return {data:data.filter(x=>cursor===null||x.id>cursor).slice(0,Math.min(cap,limit))}}).then(resolve,reject)}};
}
test('1251 records survive default page limit',async()=>{const result=await ctx.testReadPaged(()=>query(rows));assert.equal(result.length,1251);assert.equal(result.at(-1).id,'001251')});
test('lower server limit does not silently truncate',async()=>{const result=await ctx.testReadPaged(()=>query(rows,123));assert.equal(result.length,1251)});
test('empty database returns empty array',async()=>{assert.equal((await ctx.testReadPaged(()=>query([]))).length,0)});
test('later page error rejects entire load',async()=>{let n=0;await assert.rejects(ctx.testReadPaged(()=>query(rows,500,()=>{if(++n===2)throw Error('offline')})),/offline/)});
test('nonarray response fails closed',async()=>{await assert.rejects(ctx.testReadPaged(()=>({order(){return this},limit(){return this},then(resolve){resolve({data:null})}})),/Unvollständige/)});
test('duplicate ids abort instead of returning partial data',async()=>{await assert.rejects(ctx.testReadPaged(()=>query([{id:'a'},{id:'a'}])),/eindeutig/)});
test('account change aborts during page read',async()=>{let active=true;await assert.rejects(ctx.testReadPaged(()=>query(rows,500,()=>{active=false}),()=>{if(!active)throw Error('account changed')}),/account changed/)});
test('child queries use bounded batches and retain position order',async()=>{const ids=Array.from({length:201},(_,i)=>String(i));const calls=[];const data=ids.flatMap((p,i)=>[{id:String(i*2+1).padStart(6,'0'),position:2,parent:p},{id:String(i*2+2).padStart(6,'0'),position:1,parent:p}]);const c={assert(){},client:{from(){return {select(){return this},in(col,chunk){calls.push(chunk.length);return query(data.filter(r=>chunk.includes(r.parent)),37)}}}}};const result=await ctx.testChildRows(c,'lines','parent',ids);assert.equal(result.length,402);assert.equal(Math.max(...calls),100);assert.equal(result[0].position,1);assert.equal(result.at(-1).position,2)});
