import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const marker='  globalThis.CloudSync=';
const c=vm.createContext({});
vm.runInContext(source.replace(marker,'  globalThis.testUpsert=upsertRows;\n'+marker),c);
function fixture(response){
 const calls=[];const ctx={companyId:'company-a',assert(){},client:{from(table){calls.push(table);return {upsert(){return this},async select(){return response}}}}};
 return {ctx,calls};
}
test('deleted record conflict is explicit and not silently successful',async()=>{
 const {ctx,calls}=fixture({error:{code:'23514',message:'SYNC_DELETED_RECORD_CONFLICT'}});
 await assert.rejects(c.testUpsert(ctx,'customers',[{company_id:'company-a'}]),/anderen Gerät gelöscht/);
 assert.equal(calls.length,1);
});
test('ordinary database failures remain failures',async()=>{
 const err=Error('offline'),{ctx}=fixture({error:err});
 await assert.rejects(c.testUpsert(ctx,'customers',[{company_id:'company-a'}]),/offline/);
});
test('successful writes remain acknowledged',async()=>{
 const {ctx}=fixture({data:[{id:'a'}]});
 assert.equal((await c.testUpsert(ctx,'customers',[{company_id:'company-a'}])).length,1);
});
