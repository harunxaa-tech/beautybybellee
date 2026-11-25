import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {patchStripe} from '../scripts/patch-stripe-webhook.mjs';
const base=[
'function stripeSubStatus(s:string){if(s==="trialing")return"trial";if(s==="active")return"active";if(s==="past_due")return"past_due";if(s==="unpaid"||s==="paused")return"restricted";if(s==="canceled"||s==="incomplete_expired")return"cancelled";return"past_due"}\nfunction pricePlan',
'return json({ok:true,in_progress:true});','return json({ok:true,in_progress:true});',
'const {data:existing}=await db.from("billing_webhook_events")','  if(existing?.status==="processed"',
'const {data:dupe}=await db.from("billing_webhook_events")','      if(dupe?.status==="processed"',
'  let companyId="";','if(type==="checkout.session.completed"){\n      if(!companyId)',
'        const plan=String(obj?.metadata?.plan||"");\n','        if(["solo","team","pro"].includes(plan))patch.plan=plan;\n',
'mappedPlan=String(obj?.metadata?.plan||pricePlan(priceId));',
'select("status,provider_subscription_id")','select("status,provider_subscription_id")',
'select("status,grace_ends_at,provider_subscription_id")',
...Array(3).fill('const sameSubscription=!invoiceSubscriptionId||!currentSubId||invoiceSubscriptionId===currentSubId;'),
...Array(3).fill('String(current?.status||"")!=="cancelled"&&sameSubscription'),
'    await db.from("billing_webhook_events").update({company_id:companyId||null,status:companyId?"processed":"ignored",processed_at:new Date().toISOString(),error:""}).eq("provider","stripe").eq("event_id",eventId);'
].join('\n');
const out=patchStripe(base);
const code=out.slice(0,out.indexOf('\nfunction pricePlan')).replace('s:string','s');
const ctx=vm.createContext({});
vm.runInContext(code,ctx);
test('incomplete and unknown status never grant grace access',()=>{for(const s of ['incomplete','unknown',''])assert.equal(ctx.stripeSubStatus(s),'restricted')});
test('supported status mappings preserved',()=>{for(const [s,v] of [['active','active'],['trialing','trial'],['past_due','past_due'],['unpaid','restricted'],['canceled','cancelled']])assert.equal(ctx.stripeSubStatus(s),v)});
test('busy event requests are retryable instead of acknowledged',()=>{assert.equal((out.match(/event processing; retry/g)||[]).length,2);assert.doesNotMatch(out,/ok:true,in_progress:true/)});
test('event lookup failures are not ignored',()=>{assert.match(out,/if\(existingError\)return json/);assert.match(out,/if\(dupeError\)return json/)});
test('checkout requires a subscription and cannot grant a plan from metadata',()=>{assert.match(out,/obj.mode!=="subscription"/);assert.doesNotMatch(out,/patch.plan=plan/)});
test('plan mapping uses configured price and rejects unknown price',()=>{assert.match(out,/mappedPlan=pricePlan\(priceId\)/);assert.match(out,/if\(!mappedPlan\)throw/)});
const binding=out.match(/const sameSubscription=([^;]+);/)[1];
const match=(invoiceSubscriptionId,currentSubId,current,event)=>vm.runInNewContext(binding,{invoiceSubscriptionId,currentSubId,current,event});
test('invoice binding requires same subscription, provider and environment',()=>{const stripe={billing_provider:'stripe',provider_livemode:false};assert.equal(match('sub_a','sub_a',stripe,{livemode:false}),true);for(const [a,b,c,d] of [['','sub_a',stripe,false],['sub_a','',stripe,false],['sub_b','sub_a',stripe,false],['sub_a','sub_a',{...stripe,billing_provider:'apple'},false],['sub_a','sub_a',stripe,true]])assert.equal(match(a,b,c,{livemode:d}),false)});
test('completion write failure is propagated and changed source fails safely',()=>{assert.match(out,/if\(finishError\)throw finishError/);assert.throws(()=>patchStripe(base.replace('return"past_due"}','return"active"}')),/Unexpected source/)});
