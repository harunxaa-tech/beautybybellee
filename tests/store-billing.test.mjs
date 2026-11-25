import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../store-billing.js',import.meta.url),'utf8');
const product={plan:'solo',product_id:'solo.monthly'};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function fixture({role='owner',platform='ios',verified=true,access={},catalogGate=null}={}){
  const calls={purchase:[],restore:[],web:[],toast:[]};
  const company={id:'company-a'},user={id:'user-a'};
  const gate=deferred(),started=deferred();
  const context={session:{user},company,membership:{role},client:{rpc:async()=>{
    if(catalogGate)await catalogGate.promise;
    return {data:{configured:true,verification_ready:verified,verification_mode:'app_store_server_api',products:[product]}};
  }}};
  const bridge={loadProducts:async()=>[{...product,priceString:'24,99 €'}],purchase:async a=>{calls.purchase.push(a);started.resolve();return gate.promise},restore:async a=>{calls.restore.push(a);return {}}};
  const ctx=vm.createContext({document:{getElementById:()=>null,addEventListener(){},documentElement:{dataset:{}}},Capacitor:{getPlatform:()=>platform,isNativePlatform:()=>platform!=='web'},APCloudContext:()=>context,APNativeStoreBilling:bridge,SubscriptionBilling:{_state:()=>({access}),__webStartCheckout:async p=>calls.web.push(p)},toast:(...a)=>calls.toast.push(a),console:{warn(){},error(){},log(){}},setTimeout:()=>0,clearTimeout(){}});
  vm.runInContext(src,ctx);
  return {api:ctx.StoreBilling,calls,context,gate,started};
}
test('web checkout stays on the web',async()=>{const {api,calls}=fixture({platform:'web'});await api.purchase('solo');assert.deepEqual(calls.web,['solo']);assert.equal(calls.purchase.length,0)});
test('worker cannot purchase or restore',async()=>{const {api,calls}=fixture({role:'worker'});await api.purchase('solo');await api.restore();assert.equal(calls.purchase.length,0);assert.equal(calls.restore.length,0)});
test('unverified server configuration fails closed',async()=>{const {api,calls}=fixture({verified:false});await api.purchase('solo');await api.restore();assert.equal(calls.purchase.length,0);assert.equal(calls.restore.length,0)});
test('active external subscription cannot purchase or restore a second subscription',async()=>{const {api,calls}=fixture({access:{billing_provider:'stripe',has_provider_subscription:true,status:'active'}});await api.purchase('solo');await api.restore();assert.equal(calls.purchase.length,0);assert.equal(calls.restore.length,0)});
test('concurrent purchase and restore are blocked while purchase is pending',async()=>{const {api,calls,gate,started}=fixture();const first=api.purchase('solo');await started.promise;await Promise.all([api.purchase('solo'),api.restore()]);assert.equal(calls.purchase.length,1);assert.equal(calls.restore.length,0);gate.resolve({cancelled:true});await first;await api.restore();assert.equal(calls.restore.length,1)});
test('company switch while catalog loads blocks purchase',async()=>{const catalogGate=deferred();const {api,calls,context}=fixture({catalogGate});const action=api.purchase('solo');context.company={id:'company-b'};catalogGate.resolve();await action;assert.equal(calls.purchase.length,0)});
test('successful native bridge uses captured company and does not claim confirmed payment',async()=>{const {api,calls,gate,started}=fixture();const action=api.purchase('solo');await started.promise;assert.equal(calls.purchase[0].companyId,'company-a');gate.resolve({});await action;assert.equal(calls.toast.some(t=>t[1]==='success'),false)});
