-- Applied migration: prevent_business_record_resurrection, 2026-11-25.
create function private.prevent_sync_resurrection()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $fn$
begin
 if old.deleted_at is not null and new.deleted_at is null then
   raise exception 'SYNC_DELETED_RECORD_CONFLICT' using errcode='23514';
 end if;
 return new;
end $fn$;
revoke all on function private.prevent_sync_resurrection() from public,anon,authenticated;
do $migration$
declare t text;
begin
 foreach t in array array['customers','catalog_items','offers','jobs','events','tasks','invoices'] loop
   execute format('create trigger trg_prevent_sync_resurrection before update on public.%I for each row when (old.deleted_at is not null and new.deleted_at is null) execute function private.prevent_sync_resurrection()',t);
 end loop;
end $migration$;
