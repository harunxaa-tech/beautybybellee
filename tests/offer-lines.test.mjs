import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const marker='  globalThis.CloudSync=';
assert.equal(src.split(marker).length,2);
const vmctx=vm.createContext({});
vm.runInContext(src.replace(marker,'  globalThis.testSaveOfferLines=saveOfferLines;\n'+marker),vmctx);
const offer={id:'offer-a',lines:[{id:'line-1',name:'Work',qty:2,price:3,unit:'Std.'},{name:'Material',qty:1,price:5,type:'material'}]};
function fixture(response={data:2}){const calls=[];const c={companyId:'company-a',assert(){},client:{async rpc(name,args){calls.push({name,args});return response}}};return {c,calls}}
test('one atomic RPC carries all positions in order',async()=>{const {c,calls}=fixture();await vmctx.testSaveOfferLines(c,offer,{id:'remote-offer'});assert.equal(calls.length,1);const {name,args}=calls[0];assert.equal(name,'replace_offer_lines_atomic');assert.equal(args.p_company_id,'company-a');assert.equal(args.p_offer_id,'remote-offer');assert.equal(args.p_lines.length,2);assert.equal(args.p_lines[1].position,2);assert.equal(args.p_lines[1].local_id,'offer-a:line:1')});
test('empty snapshot cannot erase existing lines',async()=>{const {c,calls}=fixture();await assert.rejects(vmctx.testSaveOfferLines(c,{...offer,lines:[]},{id:'remote-offer'}),/ohne Positionen/);assert.equal(calls.length,0)});
test('database error propagates without fallback delete',async()=>{const {c,calls}=fixture({error:Error('offline')});await assert.rejects(vmctx.testSaveOfferLines(c,offer,{id:'remote-offer'}),/offline/);assert.equal(calls.length,1)});
test('partial acknowledgement is not success',async()=>{const {c}=fixture({data:1});await assert.rejects(vmctx.testSaveOfferLines(c,offer,{id:'remote-offer'}),/nicht vollständig/)});
test('stale account cannot start request',async()=>{const {c,calls}=fixture();c.assert=()=>{throw Error('switched')};await assert.rejects(vmctx.testSaveOfferLines(c,offer,{id:'remote-offer'}),/switched/);assert.equal(calls.length,0)});
test('account switch during request cannot acknowledge old workspace',async()=>{const {c,calls}=fixture();let checks=0;c.assert=()=>{if(++checks===2)throw Error('switched')};await assert.rejects(vmctx.testSaveOfferLines(c,offer,{id:'remote-offer'}),/switched/);assert.equal(calls.length,1)});
