import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {patchCheckout} from '../scripts/patch-stripe-checkout.mjs';
const base="    let customerId=String(sub.provider_customer_id||\"\");\n    const session=await stripeRequest(\"checkout/sessions\",\"POST\",p);\nconst res=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers,body:params?.toString()});";
const patched=patchCheckout(base);
const preflight=patched.slice(0,patched.indexOf('    let customerId='));
async function run({body={business_confirmation:true,terms_version:'v1',plan:'solo'},sub={plan:'solo',provider_subscription_id:'',status:'trial'},reservation={data:'attempt-a'},action='checkout',price='price_a'}={}){
 const calls=[];
 const fn=vm.runInNewContext('(async()=>{'+preflight+';return {attemptId}})',{action,body,sub,companyId:'c',user:{id:'u'},TERMS_VERSION:'v1',PLAN_ENV:{solo:'PRICE'},Deno:{env:{get:()=>price}},service:{rpc:async(name,args)=>{calls.push({name,args});return reservation}},json:(value,status)=>({value,status})});
 return {result:await fn(),calls};
}
test('valid checkout acquires server reservation before external calls',async()=>{const {result,calls}=await run();assert.equal(result.attemptId,'attempt-a');assert.equal(calls.length,1);assert.equal(calls[0].name,'reserve_checkout_attempt');assert.equal(calls[0].args.p_company,'c')});
test('existing Apple or Stripe subscription blocks checkout',async()=>{const {result,calls}=await run({sub:{provider_subscription_id:'sub',status:'active',billing_provider:'apple'}});assert.equal(result.status,409);assert.equal(calls.length,0)});
test('terms version and business confirmation must match',async()=>{for(const body of [{business_confirmation:true,terms_version:'old'},{business_confirmation:false,terms_version:'v1'}]){const {result,calls}=await run({body});assert.ok(result.status>=400);assert.equal(calls.length,0)}});
test('unconfigured or invalid plan cannot reserve',async()=>{for(const input of [{price:''},{body:{business_confirmation:true,terms_version:'v1',plan:'other'}}]){const {result,calls}=await run(input);assert.ok(result.status>=400);assert.equal(calls.length,0)}});
test('pending or failed reservation blocks Stripe call',async()=>{for(const reservation of [{error:{message:'CHECKOUT_ALREADY_PENDING'}},{data:null}]){const {result}=await run({reservation});assert.equal(result.status,409)}});
test('same attempt id binds checkout metadata and provider idempotency',()=>{assert.match(patched,/metadata\[checkout_attempt_id\]/);assert.match(patched,/subscription_data\[metadata\]\[checkout_attempt_id\]/);assert.match(patched,/"angebotspilot-checkout-"\+attemptId/);assert.match(patched,/AbortSignal\.timeout\(30000\)/);assert.doesNotMatch(patched,/release_checkout_attempt_verified/)});
test('invalid upstream source is rejected',()=>{assert.throws(()=>patchCheckout(base.replace('let customerId','let otherId')),/Unexpected source/)});
