-- Reference only: current functions after durable_stripe_event_inbox migration.
-- Requires existing private.stripe_event_inbox table and restricted grants. Not standalone migration.
CREATE OR REPLACE FUNCTION public.claim_stripe_inbox_event(p_livemode boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
declare r private.stripe_event_inbox%rowtype; t timestamptz:=clock_timestamp();
begin
 if p_livemode is null then raise exception 'STRIPE_INBOX_INVALID' using errcode='22023'; end if;
 -- Expired final attempts remain inspectable, never silently discarded.
 update private.stripe_event_inbox set state='dead',lease_token=null,lease_until=null,updated_at=t,last_error_code='lease_exhausted'
 where livemode=p_livemode and state='processing' and lease_until<=t and attempts>=10;
 select * into r from private.stripe_event_inbox
 where livemode=p_livemode and attempts<10 and ((state in ('pending','retry') and next_attempt_at<=t) or (state='processing' and lease_until<=t))
 order by next_attempt_at,received_at,event_id for update skip locked limit 1;
 if not found then return null; end if;
 update private.stripe_event_inbox set state='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=t+interval '5 minutes',updated_at=t
 where event_id=r.event_id returning * into r;
 return jsonb_build_object('event_id',r.event_id,'event_type',r.event_type,'livemode',r.livemode,'lease_token',r.lease_token,'lease_until',r.lease_until,'attempts',r.attempts);
end $function$;

CREATE OR REPLACE FUNCTION public.enqueue_verified_stripe_event(p_event_id text, p_event_type text, p_livemode boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
declare r private.stripe_event_inbox%rowtype;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{1,200}$' or p_event_type is null or p_event_type !~ '^[a-z][a-z0-9_.]{1,119}$' or p_livemode is null then
 raise exception 'STRIPE_INBOX_INVALID' using errcode='22023'; end if;
 insert into private.stripe_event_inbox(event_id,event_type,livemode) values(p_event_id,p_event_type,p_livemode) on conflict(event_id) do nothing;
 if found then return 'queued'; end if;
 select * into strict r from private.stripe_event_inbox where event_id=p_event_id;
 if r.event_type is distinct from p_event_type or r.livemode is distinct from p_livemode then raise exception 'STRIPE_INBOX_CONFLICT'; end if;
 return 'duplicate';
end $function$;

CREATE OR REPLACE FUNCTION public.finish_stripe_inbox_event(p_event_id text, p_lease uuid, p_success boolean, p_error_code text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
declare r private.stripe_event_inbox%rowtype; t timestamptz;
begin
 if p_event_id is null or p_lease is null or p_success is null or coalesce(p_error_code,'') !~ '^[a-z0-9_]{0,64}$' then raise exception 'STRIPE_INBOX_INVALID' using errcode='22023'; end if;
 select * into r from private.stripe_event_inbox where event_id=p_event_id for update;
 t:=clock_timestamp();
 if not found or r.state<>'processing' or r.lease_token is distinct from p_lease or r.lease_until<=t then return false; end if;
 update private.stripe_event_inbox set state=case when p_success then 'done' when attempts>=10 then 'dead' else 'retry' end,
 lease_token=null,lease_until=null,updated_at=t,last_error_code=case when p_success then '' else coalesce(nullif(p_error_code,''),'processing_failed') end,
 next_attempt_at=case when p_success then t else t+make_interval(secs=>least(3600,30*power(2,attempts-1))::integer) end
 where event_id=p_event_id;
 return true;
end $function$;
