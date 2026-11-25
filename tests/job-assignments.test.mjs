import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const marker='  globalThis.CloudSync=';
assert.equal(source.split(marker).length,2);
const ctx=vm.createContext({});
vm.runInContext(source.replace(marker,'  globalThis.testSaveJobAssignments=saveJobAssignments;\n'+marker),ctx);
function fixture(result={data:2}){const calls=[];return {calls,c:{companyId:'company-a',assert(){},client:{async rpc(name,args){calls.push({name,args});return result}}}}}
const job={assignedUserIds:['a','b','a']},remote={id:'job-a'};
test('one atomic request with deduplicated worker ids',async()=>{const {c,calls}=fixture();await ctx.testSaveJobAssignments(c,job,remote);assert.equal(calls.length,1);assert.equal(calls[0].name,'replace_job_assignments_atomic');assert.equal(calls[0].args.p_company_id,'company-a');assert.equal(calls[0].args.p_job_id,'job-a');assert.deepEqual(Array.from(calls[0].args.p_user_ids),['a','b'])});
test('missing assignment field never deletes workers',async()=>{const {c,calls}=fixture();await ctx.testSaveJobAssignments(c,{},remote);assert.equal(calls.length,0)});
test('explicit empty list can remove assignments',async()=>{const {c,calls}=fixture({data:0});await ctx.testSaveJobAssignments(c,{assignedUserIds:[]},remote);assert.equal(calls[0].args.p_user_ids.length,0)});
test('invalid worker identifier blocks call',async()=>{const {c,calls}=fixture();await assert.rejects(ctx.testSaveJobAssignments(c,{assignedUserIds:['a',null]},remote),/Ungültige/);assert.equal(calls.length,0)});
test('server validation failure propagates without fallback delete',async()=>{const {c,calls}=fixture({error:Error('invalid worker')});await assert.rejects(ctx.testSaveJobAssignments(c,job,remote),/invalid worker/);assert.equal(calls.length,1)});
test('incomplete server confirmation is rejected',async()=>{const {c}=fixture({data:1});await assert.rejects(ctx.testSaveJobAssignments(c,job,remote),/nicht vollständig/)});
test('changed account cannot send assignment update',async()=>{const {c,calls}=fixture();c.assert=()=>{throw Error('account changed')};await assert.rejects(ctx.testSaveJobAssignments(c,job,remote),/account changed/);assert.equal(calls.length,0)});
test('changed account cannot acknowledge previous update',async()=>{const {c,calls}=fixture();let n=0;c.assert=()=>{if(++n===2)throw Error('account changed')};await assert.rejects(ctx.testSaveJobAssignments(c,job,remote),/account changed/);assert.equal(calls.length,1)});
