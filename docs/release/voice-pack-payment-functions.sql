-- Current verified functions; reference only, not standalone migration.
-- Existing private tables and service-role grants required.
CREATE OR REPLACE FUNCTION public.apply_verified_voice_pack_payment(p_order uuid, p_company uuid, p_payment_id text, p_price_id text, p_amount_cents integer, p_currency text, p_livemode boolean, p_paid_at timestamp with time zone, p_refunded_cents integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare o private.voice_pack_orders%rowtype; g uuid; v_state text; v_expiry timestamptz;
begin
 if p_order is null or p_company is null or p_livemode is distinct from true or p_payment_id is null or p_payment_id !~ '^pi_[A-Za-z0-9_]{1,200}$' or p_paid_at is null or p_paid_at>now()+interval '5 minutes' or p_refunded_cents is null or p_refunded_cents<0 then raise exception 'VOICE_PACK_PROOF_INVALID' using errcode='22023'; end if;
 -- Share the existing quota-consumption lock so refund and voice debit cannot race.
 perform pg_advisory_xact_lock(hashtextextended('angebotspilot-voice-'||p_company::text,0));
 select * into o from private.voice_pack_orders where id=p_order and company_id=p_company for update;
 if not found then raise exception 'VOICE_PACK_ORDER_MISMATCH'; end if;
 if p_price_id is distinct from o.provider_price_id or p_amount_cents is distinct from o.amount_cents or p_currency is distinct from o.currency or p_refunded_cents>o.amount_cents or p_paid_at<o.created_at-interval '5 minutes' then raise exception 'VOICE_PACK_PAYMENT_MISMATCH'; end if;
 if o.payment_id is not null and (o.payment_id is distinct from p_payment_id or o.paid_at is distinct from p_paid_at) then raise exception 'VOICE_PACK_PAYMENT_CONFLICT'; end if;
 if p_refunded_cents<o.refunded_cents then raise exception 'VOICE_PACK_STALE_REFUND'; end if;
 v_state:=case when p_refunded_cents>0 then 'revoked' when p_paid_at+interval '12 months'<=now() then 'expired' else 'paid' end;
 v_expiry:=p_paid_at+interval '12 months';
 if o.grant_id is null then
   insert into private.company_resource_grants(company_id,resource,total_units,consumed_units,payment_status,provider,provider_reference,starts_at,expires_at)
   values(o.company_id,'voice_seconds',o.seconds,0,v_state,'stripe',p_payment_id,p_paid_at,v_expiry) returning id into g;
 else
   g:=o.grant_id;
   update private.company_resource_grants set payment_status=case when payment_status='revoked' then 'revoked' else v_state end where id=g and company_id=o.company_id returning payment_status into v_state;
   if not found then raise exception 'VOICE_PACK_GRANT_MISSING'; end if;
 end if;
 update private.voice_pack_orders set payment_id=p_payment_id,paid_at=p_paid_at,refunded_cents=p_refunded_cents,grant_id=g where id=o.id;
 return jsonb_build_object('ok',true,'grant_id',g,'state',v_state,'refund_review_required',p_refunded_cents>0 and p_refunded_cents<o.amount_cents);
end $function$;

CREATE OR REPLACE FUNCTION public.prepare_voice_pack_order(p_company uuid, p_owner uuid, p_sku text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare c private.voice_pack_catalog%rowtype; v_id uuid;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_owner and role='owner' and status='active') then raise exception 'VOICE_PACK_OWNER_REQUIRED' using errcode='42501'; end if;
 if not coalesce(private.subscription_write_allowed(p_company),false) then raise exception 'VOICE_PACK_SUBSCRIPTION_REQUIRED'; end if;
 select * into c from private.voice_pack_catalog where sku=p_sku and enabled;
 if not found then raise exception 'VOICE_PACK_NOT_CONFIGURED'; end if;
 insert into private.voice_pack_orders(company_id,owner_id,sku,provider_price_id,seconds,amount_cents,currency)
 values(p_company,p_owner,c.sku,c.provider_price_id,case c.sku when 'voice_100' then 6000 when 'voice_500' then 30000 when 'voice_1500' then 90000 end,c.amount_cents,c.currency) returning id into v_id;
 return v_id;
end $function$;
