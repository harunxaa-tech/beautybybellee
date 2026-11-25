-- Atomic replacement of the positions of one offer. Existing RLS remains active.
create or replace function public.replace_offer_lines_atomic(p_company_id uuid,p_offer_id uuid,p_lines jsonb)
returns integer language plpgsql security invoker
set search_path = pg_catalog, public, private
as $fn$
declare
  v_count integer;
begin
  if auth.uid() is null or private.company_role(p_company_id) is null or private.company_role(p_company_id) not in ('owner','office') then
    raise exception 'OFFER_LINES_FORBIDDEN' using errcode='42501';
  end if;
  perform 1 from public.offers o where o.id=p_offer_id and o.company_id=p_company_id and o.deleted_at is null for update;
  if not found then raise exception 'OFFER_NOT_FOUND' using errcode='42501'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'OFFER_LINES_INVALID' using errcode='22023'; end if;
  v_count:=jsonb_array_length(p_lines);
  if v_count=0 or v_count>5000 then raise exception 'OFFER_LINES_COUNT_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_to_recordset(p_lines) as r(local_id text,position integer,name text,qty numeric,unit text,price numeric,type text,workers integer,hours_per_worker numeric)
    where nullif(btrim(r.local_id),'') is null or nullif(btrim(r.name),'') is null or nullif(btrim(r.unit),'') is null
    or r.position is null or r.position<1 or r.position>v_count or r.qty is null or r.price is null
    or r.type is null or r.type not in ('service','material')
    or r.qty::text in ('NaN','Infinity','-Infinity') or r.price::text in ('NaN','Infinity','-Infinity'))
    then raise exception 'OFFER_LINE_INVALID' using errcode='22023'; end if;
  if (select count(distinct r.local_id) from jsonb_to_recordset(p_lines) as r(local_id text))<>v_count
    or (select count(distinct r.position) from jsonb_to_recordset(p_lines) as r(position integer))<>v_count
    then raise exception 'OFFER_LINES_DUPLICATE' using errcode='22023'; end if;
  insert into public.offer_lines(offer_id,local_id,position,name,qty,unit,price,type,workers,hours_per_worker)
    select p_offer_id,r.local_id,r.position,r.name,r.qty,r.unit,r.price,r.type,r.workers,r.hours_per_worker
    from jsonb_to_recordset(p_lines) as r(local_id text,position integer,name text,qty numeric,unit text,price numeric,type text,workers integer,hours_per_worker numeric)
    on conflict (offer_id,local_id) do update set position=excluded.position,name=excluded.name,qty=excluded.qty,unit=excluded.unit,price=excluded.price,type=excluded.type,workers=excluded.workers,hours_per_worker=excluded.hours_per_worker;
  delete from public.offer_lines l where l.offer_id=p_offer_id and not exists(select 1 from jsonb_to_recordset(p_lines) as r(local_id text) where r.local_id=l.local_id);
  if (select count(*) from public.offer_lines where offer_id=p_offer_id)<>v_count then raise exception 'OFFER_LINES_INCOMPLETE'; end if;
  return v_count;
end
$fn$;
revoke all on function public.replace_offer_lines_atomic(uuid,uuid,jsonb) from public,anon;
grant execute on function public.replace_offer_lines_atomic(uuid,uuid,jsonb) to authenticated;
