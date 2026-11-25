export function patchCheckout(source){
 let s=source;
 function replace(a,b){if(s.split(a).length!==2)throw Error("Unexpected source: "+a.slice(0,80));s=s.replace(a,b)}
 replace('    let customerId=String(sub.provider_customer_id||"");',`    if(action!=="checkout"&&action!=="portal")return json({error:"invalid_action"},400);
    if(action==="portal"&&sub.billing_provider!=="stripe")return json({error:"stripe_subscription_required"},409);
    let attemptId="";
    if(action==="checkout"){
      if(sub.provider_subscription_id&&sub.status!=="cancelled")return json({error:"subscription_exists"},409);
      if(body.business_confirmation!==true)return json({error:"business_confirmation_required"},400);
      if(body.terms_version!==TERMS_VERSION)return json({error:"terms_version_mismatch"},409);
      const requestedPlan=String(body.plan||sub.plan||"solo");
      if(!Object.hasOwn(PLAN_ENV,requestedPlan))return json({error:"invalid_plan"},400);
      if(!Deno.env.get(PLAN_ENV[requestedPlan]))return json({error:"price_not_configured"},503);
      const {data:reservation,error:reservationError}=await service.rpc("reserve_checkout_attempt",{p_company:companyId,p_owner:user.id,p_provider:"stripe",p_plan:requestedPlan});
      if(reservationError||typeof reservation!=="string"||!reservation)return json({error:"checkout_unavailable_or_pending"},409);
      attemptId=reservation;
    }
    let customerId=String(sub.provider_customer_id||"");`);
 replace('    const session=await stripeRequest("checkout/sessions","POST",p);',`    if(!attemptId)throw new Error("checkout_reservation_required");
    p.set("metadata[checkout_attempt_id]",attemptId);
    p.set("subscription_data[metadata][checkout_attempt_id]",attemptId);
    const session=await stripeRequest("checkout/sessions","POST",p,"angebotspilot-checkout-"+attemptId);`);
 replace('const res=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers,body:params?.toString()});','const res=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers,body:params?.toString(),signal:AbortSignal.timeout(30000)});');
 return s;
}
