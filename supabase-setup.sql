-- Ejecutá esto una sola vez en Supabase: Project → SQL Editor → New query → pegar → Run

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Habilita Row Level Security
alter table kv_store enable row level security;

-- Como esta app es de uso personal (no tiene login de usuarios),
-- esta política permite leer y escribir a cualquiera que tenga tu URL y
-- tu "anon key". Son datos random, no son secretos "top secret", pero
-- OJO: no compartas tu URL de Supabase ni el anon key públicamente,
-- porque quien los tenga podría ver o editar los datos de tu taller.
create policy "Permitir todo con anon key"
  on kv_store
  for all
  using (true)
  with check (true);
