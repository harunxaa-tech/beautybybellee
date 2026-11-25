-- Verified function definitions after migrations 2026-11-25.
-- Reference only; not a migration. Existing schema and grants required.
CREATE OR REPLACE FUNCTION private.apply_verified_store_subscription(p_company_id uuid, p_provider text, p_plan text, p_status text, p_product_id text, p_provider_subscription_id text, p_original_transaction_id text, p_purchase_token_hash text, p_environment text, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_cancel_at_period_end boolean, p_event_id text, p_event_type text, p_event_at timestamp with time zone, p_payload_sha256 text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_provider text:=lower(coalesce(p_provider,''));
  v_environment text:=lower(coalesce(p_environment,''));
  v_plan text:=lower(coalesce(p_plan,''));
  v_status text:=lower(coalesce(p_status,''));
  v_inserted uuid;
  v_current public.company_subscriptions%rowtype;
begin
  if v_provider not in ('apple','google') then raise exception 'INVALID_STORE_PROVIDER'; end if;
  if v_environment not in ('sandbox','production') then raise exception 'INVALID_STORE_ENVIRONMENT'; end if;
  if v_plan not in ('solo','team','pro') then raise exception 'INVALID_PLAN'; end if;
  if v_status not in ('trial','active','past_due','grace_period','restricted','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if coalesce(btrim(p_product_id),'')='' then raise exception 'STORE_PRODUCT_REQUIRED'; end if;
  if coalesce(btrim(p_provider_subscription_id),'')='' then raise exception 'STORE_SUBSCRIPTION_REQUIRED'; end if;
  if coalesce(btrim(p_event_id),'')='' then raise exception 'STORE_EVENT_REQUIRED'; end if;
  if coalesce(p_payload_sha256,'') !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_PAYLOAD_SHA256'; end if;

  if not exists(
    select 1 from public.subscription_store_products p
    where p.provider=v_provider
      and p.environment=v_environment
      and p.plan=v_plan
      and p.product_id=p_product_id
      and p.active
  ) then
    raise exception 'STORE_PRODUCT_NOT_CONFIGURED';
  end if;

  if p_event_at is null or p_event_at > now()+interval '5 minutes' then raise exception 'INVALID_STORE_EVENT_TIME'; end if;
  if v_status in ('active','trial','past_due','grace_period') and p_period_end is null then raise exception 'STORE_EXPIRY_REQUIRED'; end if;
  perform 1 from public.companies where id=p_company_id for update;
  if not found then raise exception 'STORE_COMPANY_REQUIRED'; end if;
  select * into v_current from public.company_subscriptions where company_id=p_company_id for update;
  if found and coalesce(v_current.provider_subscription_id,'')<>'' then
    if v_current.provider_livemode and v_environment='sandbox' then raise exception 'STORE_ENVIRONMENT_CONFLICT'; end if;
    if v_current.status<>'cancelled' and
      (v_current.billing_provider<>v_provider or v_current.provider_environment<>v_environment or v_current.provider_subscription_id<>p_provider_subscription_id)
    then raise exception 'STORE_SUBSCRIPTION_CONFLICT'; end if;
    if v_current.billing_provider=v_provider and v_current.provider_environment=v_environment
       and v_current.provider_subscription_id=p_provider_subscription_id and v_current.last_provider_event_at is not null
    then
      if p_event_at<v_current.last_provider_event_at then raise exception 'STORE_EVENT_STALE'; end if;
      if p_event_at=v_current.last_provider_event_at and
        (v_current.status is distinct from v_status or v_current.plan is distinct from v_plan
         or v_current.current_period_end is distinct from p_period_end
         or v_current.cancel_at_period_end is distinct from coalesce(p_cancel_at_period_end,false))
      then raise exception 'STORE_EVENT_ORDER_UNCERTAIN'; end if;
    end if;
  end if;

  insert into public.subscription_store_events(
    provider,provider_event_id,company_id,provider_subscription_id,
    provider_original_transaction_id,event_type,event_at,payload_sha256,metadata
  )
  values(
    v_provider,p_event_id,p_company_id,p_provider_subscription_id,
    coalesce(p_original_transaction_id,''),coalesce(p_event_type,''),p_event_at,
    lower(p_payload_sha256),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(provider,provider_event_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    if not exists(select 1 from public.subscription_store_events e where e.provider=v_provider and e.provider_event_id=p_event_id and e.company_id=p_company_id and e.provider_subscription_id=p_provider_subscription_id and e.payload_sha256=lower(p_payload_sha256)) then
      raise exception 'STORE_EVENT_ID_CONFLICT';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'provider',v_provider,'event_id',p_event_id);
  end if;

  update public.company_subscriptions s
  set
    plan=v_plan,
    status=v_status,
    billing_provider=v_provider,
    provider_subscription_id=p_provider_subscription_id,
    provider_price_id=p_product_id,
    provider_product_id=p_product_id,
    provider_original_transaction_id=coalesce(p_original_transaction_id,''),
    provider_purchase_token_hash=lower(coalesce(p_purchase_token_hash,'')),
    provider_environment=v_environment,
    provider_platform=case when v_provider='apple' then 'ios' else 'android' end,
    provider_livemode=(v_environment='production'),
    provider_verified_at=now(),
    current_period_start=p_period_start,
    current_period_end=p_period_end,
    cancel_at_period_end=coalesce(p_cancel_at_period_end,false),
    grace_ends_at=case when v_status='grace_period' then p_period_end else null end,
    restricted_at=case when v_status='restricted' then coalesce(p_event_at,now()) else null end,
    last_payment_failed_at=case when v_status in ('past_due','grace_period','restricted') then coalesce(p_event_at,now()) else null end,
    cancelled_at=case when v_status='cancelled' then coalesce(p_event_at,now()) else null end,
    last_provider_event_at=coalesce(p_event_at,now()),
    updated_at=now()
  where s.company_id=p_company_id;

  if not found then
    insert into public.company_subscriptions(
      company_id,plan,status,billing_provider,
      provider_subscription_id,provider_price_id,provider_product_id,
      provider_original_transaction_id,provider_purchase_token_hash,
      provider_environment,provider_platform,provider_livemode,provider_verified_at,
      current_period_start,current_period_end,cancel_at_period_end,
      grace_ends_at,restricted_at,last_payment_failed_at,cancelled_at,last_provider_event_at
    )
    values(
      p_company_id,v_plan,v_status,v_provider,
      p_provider_subscription_id,p_product_id,p_product_id,
      coalesce(p_original_transaction_id,''),lower(coalesce(p_purchase_token_hash,'')),
      v_environment,case when v_provider='apple' then 'ios' else 'android' end,
      (v_environment='production'),now(),
      p_period_start,p_period_end,coalesce(p_cancel_at_period_end,false),
      case when v_status='grace_period' then p_period_end else null end,
      case when v_status='restricted' then coalesce(p_event_at,now()) else null end,
      case when v_status in ('past_due','grace_period','restricted') then coalesce(p_event_at,now()) else null end,
      case when v_status='cancelled' then coalesce(p_event_at,now()) else null end,
      coalesce(p_event_at,now())
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'duplicate',false,
    'provider',v_provider,
    'plan',v_plan,
    'status',v_status,
    'event_id',p_event_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.subscription_effective_status(target_company uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select coalesce((
    select case
      when s.billing_provider in ('apple','google')
        and s.status in ('active','grace_period','past_due')
        and (s.current_period_end is null or s.current_period_end <= now())
        then 'restricted'
      when s.status='trial' and s.trial_ends_at is not null and s.trial_ends_at <= now()
        then 'restricted'
      when s.status in ('past_due','grace_period') and s.grace_ends_at is not null and s.grace_ends_at <= now()
        then 'restricted'
      else s.status
    end
    from public.company_subscriptions s
    where s.company_id=target_company
  ), 'restricted');
$function$;

CREATE OR REPLACE FUNCTION public.get_subscription_access(target_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  result jsonb;
  member_role text;
begin
  member_role := private.company_role(target_company);
  if member_role is null then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  select jsonb_build_object(
    'company_id',s.company_id,
    'plan',s.plan,
    'status',s.status,
    'effective_status',private.subscription_effective_status(s.company_id),
    'can_write',private.subscription_write_allowed(s.company_id),
    'billing_provider',s.billing_provider,
    'provider_livemode',s.provider_livemode,
    'provider_environment',s.provider_environment,
    'provider_platform',s.provider_platform,
    'provider_product_id',case when member_role='owner' then s.provider_product_id else '' end,
    'provider_verified_at',s.provider_verified_at,
    'store_managed',(s.billing_provider in ('apple','google')),
    'has_provider_customer',(s.provider_customer_id <> ''),
    'has_provider_subscription',((s.provider_subscription_id <> '') and s.status <> 'cancelled'),
    'test_mode_enabled',case when member_role='owner' then s.test_mode_enabled else false end,
    'trial_started_at',s.trial_started_at,
    'trial_ends_at',s.trial_ends_at,
    'current_period_start',s.current_period_start,
    'current_period_end',s.current_period_end,
    'grace_ends_at',s.grace_ends_at,
    'restricted_at',s.restricted_at,
    'cancelled_at',s.cancelled_at,
    'cancel_at_period_end',s.cancel_at_period_end,
    'last_payment_failed_at',s.last_payment_failed_at,
    'billing_name',case when member_role='owner' then s.billing_name else '' end,
    'billing_email',case when member_role='owner' then s.billing_email else '' end,
    'billing_address',case when member_role='owner' then s.billing_address else '{}'::jsonb end,
    'billing_country_code',case when member_role='owner' then s.billing_country_code else '' end,
    'billing_vat_id',case when member_role='owner' then s.billing_vat_id else '' end
  ) into result
  from public.company_subscriptions s where s.company_id=target_company;

  return coalesce(result, jsonb_build_object(
    'company_id',target_company,'plan','solo','status','restricted','effective_status','restricted','can_write',false,
    'billing_provider','test','provider_livemode',false,'provider_environment','test','provider_platform','web',
    'store_managed',false,'has_provider_customer',false,'has_provider_subscription',false,'test_mode_enabled',false
  ));
end;
$function$;
