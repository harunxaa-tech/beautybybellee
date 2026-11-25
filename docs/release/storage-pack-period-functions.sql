-- Current verified functions; reference only, not standalone migration.
-- Existing private tables and service-role grants required.
CREATE OR REPLACE FUNCTION public.apply_verified_storage_pack_period(p_company uuid, p_item text, p_subscription text, p_customer text, p_invoice text, p_line text, p_price text, p_net_cents integer, p_currency text, p_quantity integer, p_prorated boolean, p_paid boolean, p_livemode boolean, p_start timestamp with time zone, p_end timestamp with time zone, p_revoke boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare b private.storage_pack_bindings%rowtype; r private.storage_pack_periods%rowtype; g uuid; v_state text;
begin
 if p_company is null or p_item is null or p_invoice is null or p_invoice !~ '^in_[A-Za-z0-9_]{1,200}$' or p_line is null or p_line !~ '^il_[A-Za-z0-9_]{1,200}$' or p_livemode is distinct from true or p_paid is distinct from true or p_prorated is distinct from false or p_quantity is distinct from 1 or p_currency is distinct from 'eur' or p_start is null or p_end is null or p_revoke is null or p_end<=p_start or p_end>p_start+interval '32 days' or p_end<p_start+interval '27 days' or p_start>now()+interval '32 days' then raise exception 'STORAGE_PACK_PROOF_INVALID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('angebotspilot-storage-'||p_company::text,0));
 select * into b from private.storage_pack_bindings where item_id=p_item and company_id=p_company for update;
 if not found or b.subscription_id is distinct from p_subscription or b.customer_id is distinct from p_customer or b.price_id is distinct from p_price or b.net_cents is distinct from p_net_cents then raise exception 'STORAGE_PACK_BINDING_MISMATCH'; end if;
 select * into r from private.storage_pack_periods where line_id=p_line for update;
 if found then
   if r.item_id is distinct from p_item or r.invoice_id is distinct from p_invoice or r.period_start is distinct from p_start or r.period_end is distinct from p_end then raise exception 'STORAGE_PACK_LINE_CONFLICT'; end if;
   if r.revoked and not p_revoke then raise exception 'STORAGE_PACK_REVOKED'; end if;
   g:=r.grant_id;
   if p_revoke then
     update private.storage_pack_periods set revoked=true where line_id=p_line;
     update private.company_resource_grants set payment_status='revoked' where id=g and company_id=p_company;
     if not found then raise exception 'STORAGE_PACK_GRANT_MISSING'; end if;
   end if;
   return jsonb_build_object('ok',true,'grant_id',g,'duplicate',true,'state',case when p_revoke then 'revoked' when p_end<=now() then 'expired' else 'paid' end);
 end if;
 if exists(select 1 from private.storage_pack_periods where item_id=p_item and period_start<p_end and period_end>p_start) then raise exception 'STORAGE_PACK_PERIOD_OVERLAP'; end if;
 v_state:=case when p_revoke then 'revoked' when p_end<=now() then 'expired' else 'paid' end;
 insert into private.company_resource_grants(company_id,resource,total_units,consumed_units,payment_status,provider,provider_reference,starts_at,expires_at)
 values(p_company,'storage_bytes',b.bytes,0,v_state,'stripe',p_line,p_start,p_end) returning id into g;
 insert into private.storage_pack_periods(line_id,invoice_id,item_id,period_start,period_end,grant_id,revoked)
 values(p_line,p_invoice,p_item,p_start,p_end,g,p_revoke);
 return jsonb_build_object('ok',true,'grant_id',g,'duplicate',false,'state',v_state);
end $function$;

CREATE OR REPLACE FUNCTION public.bind_verified_storage_pack_item(p_company uuid, p_owner uuid, p_sku text, p_item text, p_subscription text, p_customer text, p_price text, p_livemode boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare c private.storage_pack_catalog%rowtype; b private.storage_pack_bindings%rowtype;
begin
 if p_company is null or p_livemode is distinct from true or p_item is null or p_item !~ '^si_[A-Za-z0-9_]{1,200}$' or p_subscription is null or p_subscription !~ '^sub_[A-Za-z0-9_]{1,200}$' or p_customer is null or p_customer !~ '^cus_[A-Za-z0-9_]{1,200}$' then raise exception 'STORAGE_PACK_PROOF_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_owner and role='owner' and status='active') then raise exception 'STORAGE_PACK_OWNER_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('angebotspilot-storage-'||p_company::text,0));
 if not exists(select 1 from public.company_subscriptions where company_id=p_company and billing_provider='stripe' and provider_livemode and provider_customer_id=p_customer and provider_subscription_id=p_subscription and private.subscription_effective_status(p_company)='active') then raise exception 'STORAGE_PACK_SUBSCRIPTION_MISMATCH'; end if;
 select * into c from private.storage_pack_catalog where sku=p_sku and price_id=p_price and enabled;
 if not found then raise exception 'STORAGE_PACK_NOT_CONFIGURED'; end if;
 insert into private.storage_pack_bindings(item_id,company_id,subscription_id,customer_id,sku,price_id,net_cents,bytes)
 values(p_item,p_company,p_subscription,p_customer,c.sku,c.price_id,c.net_cents,case c.sku when 'storage_10' then 10737418240 when 'storage_50' then 53687091200 when 'storage_100' then 107374182400 when 'storage_500' then 536870912000 end)
 on conflict(item_id) do nothing;
 if found then return true; end if;
 select * into strict b from private.storage_pack_bindings where item_id=p_item;
 if b.company_id is distinct from p_company or b.subscription_id is distinct from p_subscription or b.customer_id is distinct from p_customer or b.sku is distinct from p_sku or b.price_id is distinct from p_price then raise exception 'STORAGE_PACK_ITEM_CONFLICT'; end if;
 return true;
end $function$;
