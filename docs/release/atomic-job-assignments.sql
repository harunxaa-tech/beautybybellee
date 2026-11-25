-- Keep unchanged assignments and their chat participants; all changes are atomic.
create or replace function public.replace_job_assignments_atomic(p_company_id uuid,p_job_id uuid,p_user_ids uuid[])
returns integer language plpgsql security invoker
set search_path=pg_catalog,public,private
as $fn$
declare v_count integer;
begin
  if auth.uid() is null or not coalesce(private.company_role(p_company_id) in ('owner','office'),false)
    then raise exception 'ASSIGNMENTS_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.jobs j where j.id=p_job_id and j.company_id=p_company_id and j.deleted_at is null for update;
  if not found then raise exception 'JOB_NOT_FOUND' using errcode='42501'; end if;
  if p_user_ids is null or coalesce(array_ndims(p_user_ids),1)<>1 or cardinality(p_user_ids)>5000 or array_position(p_user_ids,null) is not null
    then raise exception 'ASSIGNMENTS_INVALID' using errcode='22023'; end if;
  v_count:=cardinality(p_user_ids);
  if (select count(distinct u) from unnest(p_user_ids) as t(u))<>v_count
    then raise exception 'ASSIGNMENTS_DUPLICATE' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_user_ids) as t(u) where not exists(
    select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=t.u and m.role='worker' and m.status='active'))
    then raise exception 'ASSIGNMENTS_INVALID_WORKER' using errcode='22023'; end if;
  insert into public.job_assignments(company_id,job_id,user_id,assigned_by)
    select p_company_id,p_job_id,t.u,auth.uid() from unnest(p_user_ids) as t(u)
    on conflict(job_id,user_id) do nothing;
  delete from public.job_assignments a where a.company_id=p_company_id and a.job_id=p_job_id and not(a.user_id=any(p_user_ids));
  if (select count(*) from public.job_assignments a where a.company_id=p_company_id and a.job_id=p_job_id)<>v_count
    then raise exception 'ASSIGNMENTS_INCOMPLETE'; end if;
  return v_count;
end
$fn$;
revoke all on function public.replace_job_assignments_atomic(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.replace_job_assignments_atomic(uuid,uuid,uuid[]) to authenticated;
