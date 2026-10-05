-- Migración segura para la tabla pública de Tinsky.
-- IMPORTANTE: antes de ejecutar, reemplazá PEGAR-UUID-DEL-USUARIO-AQUI
-- por el UUID de tu usuario existente en Supabase → Authentication → Users.
-- Esta migración conserva las filas y las asigna a una sola cuenta.

begin;

create table if not exists public.kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table public.kv_store
  add column if not exists user_id uuid references auth.users(id);

alter table public.kv_store enable row level security;

-- Quita todas las políticas anteriores de esta tabla (incluida la política pública).
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'kv_store'
  loop
    execute format('drop policy %I on public.kv_store', policy_row.policyname);
  end loop;
end
$$;

-- Asigna las filas existentes al usuario dueño. No cambia key ni value.
update public.kv_store
set user_id = 'PEGAR-UUID-DEL-USUARIO-AQUI'::uuid
where user_id is null;

alter table public.kv_store
  alter column user_id set not null;

create policy "Tinsky: acceso solo del dueño"
  on public.kv_store
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
