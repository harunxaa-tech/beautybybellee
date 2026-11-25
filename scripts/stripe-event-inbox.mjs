// Adapter for the durable Stripe inbox. Only invoke after verification of the raw-body
// signature, timestamp and configured Stripe account/environment. Not a deployed handler.
export async function enqueueVerifiedStripeEvent(service,event,expectedLivemode){
 if(typeof expectedLivemode!=='boolean'||typeof event?.livemode!=='boolean'||event.livemode!==expectedLivemode)
   throw new Error('stripe_environment_mismatch');
 if(typeof event?.id!=='string'||!/^evt_[A-Za-z0-9_]{1,200}$/.test(event.id)||typeof event?.type!=='string'||!(/^[a-z][a-z0-9_.]{1,119}$/).test(event.type))
   throw new Error('stripe_event_invalid');
 const {data,error}=await service.rpc('enqueue_verified_stripe_event',{p_event_id:event.id,p_event_type:event.type,p_livemode:event.livemode});
 if(error||!['queued','duplicate'].includes(data))throw new Error('stripe_inbox_not_confirmed');
 return {accepted:true,duplicate:data==='duplicate'};
}
export async function claimStripeInboxEvent(service,livemode){
 if(typeof livemode!=='boolean')throw new Error('stripe_environment_mismatch');
 const {data,error}=await service.rpc('claim_stripe_inbox_event',{p_livemode:livemode});
 if(error)throw new Error('stripe_inbox_unavailable');
 if(data===null)return null;
 if(!data||data.livemode!==livemode||typeof data.event_id!=='string'||typeof data.lease_token!=='string'||!data.lease_token||!Number.isInteger(data.attempts)||data.attempts<1||data.attempts>10)
   throw new Error('stripe_claim_invalid');
 return data;
}
// Failure may be acknowledged with the lease token; successful business updates
// must later be applied AND acknowledged in one transaction. This adapter deliberately
// offers no "mark successful" operation before that transactional processor exists.
export async function retryStripeInboxEvent(service,claim,errorCode){
 if(typeof claim?.event_id!=='string'||typeof claim?.lease_token!=='string'||!claim.lease_token||typeof errorCode!=='string'||!(/^[a-z0-9_]{1,64}$/).test(errorCode))
   throw new Error('stripe_retry_invalid');
 const {data,error}=await service.rpc('finish_stripe_inbox_event',{p_event_id:claim.event_id,p_lease:claim.lease_token,p_success:false,p_error_code:errorCode});
 if(error||data!==true)throw new Error('stripe_retry_not_confirmed');
 return true;
}
