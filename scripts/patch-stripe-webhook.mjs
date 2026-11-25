export function patchStripe(source){
 let s=source;
 function replace(a,b,n=1){if(s.split(a).length!==n+1)throw Error("Unexpected source: "+a.slice(0,100));s=s.split(a).join(b)}
 replace('return"past_due"}\nfunction pricePlan','return"restricted"}\nfunction pricePlan');
 replace('return json({ok:true,in_progress:true});','return json({error:"event processing; retry"},503);',2);
 replace('const {data:existing}=await db.from("billing_webhook_events")','const {data:existing,error:existingError}=await db.from("billing_webhook_events")');
 replace('  if(existing?.status==="processed"','  if(existingError)return json({error:"event lookup failed"},503);\n  if(existing?.status==="processed"');
 replace('const {data:dupe}=await db.from("billing_webhook_events")','const {data:dupe,error:dupeError}=await db.from("billing_webhook_events")');
 replace('      if(dupe?.status==="processed"','      if(dupeError)return json({error:"event lookup failed"},503);\n      if(dupe?.status==="processed"');
 replace('  let companyId="";','  let companyId="";');
 replace('if(type==="checkout.session.completed"){\n      if(!companyId)','if(type==="checkout.session.completed"){\n      if(obj.mode!=="subscription"||!obj.subscription||!obj.customer)throw new Error("checkout subscription binding required");\n      if(!companyId)');
 replace('        const plan=String(obj?.metadata?.plan||"");\n','');
 replace('        if(["solo","team","pro"].includes(plan))patch.plan=plan;\n','');
 replace('mappedPlan=String(obj?.metadata?.plan||pricePlan(priceId));','mappedPlan=pricePlan(priceId);\n        if(!mappedPlan)throw new Error("unmapped subscription price");');
 replace('select("status,provider_subscription_id")','select("status,provider_subscription_id,billing_provider,provider_livemode")',2);
 replace('select("status,grace_ends_at,provider_subscription_id")','select("status,grace_ends_at,provider_subscription_id,billing_provider,provider_livemode")');
 replace('const sameSubscription=!invoiceSubscriptionId||!currentSubId||invoiceSubscriptionId===currentSubId;','const sameSubscription=!!invoiceSubscriptionId&&!!currentSubId&&invoiceSubscriptionId===currentSubId&&current?.billing_provider==="stripe"&&current?.provider_livemode===!!event.livemode;',3);
 replace('String(current?.status||"")!=="cancelled"&&sameSubscription','String(current?.status||"")!=="cancelled"&&sameSubscription',3);
 replace('    await db.from("billing_webhook_events").update({company_id:companyId||null,status:companyId?"processed":"ignored",processed_at:new Date().toISOString(),error:""}).eq("provider","stripe").eq("event_id",eventId);','    const {error:finishError}=await db.from("billing_webhook_events").update({company_id:companyId||null,status:companyId?"processed":"ignored",processed_at:new Date().toISOString(),error:""}).eq("provider","stripe").eq("event_id",eventId);\n    if(finishError)throw finishError;');
 return s;
}
