-- Simula o mínimo do Supabase (auth, storage, papéis) para testar as migrations
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
-- num PostgreSQL comum. NÃO rode isto no projeto Supabase real.

grant usage on schema public to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage; grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
