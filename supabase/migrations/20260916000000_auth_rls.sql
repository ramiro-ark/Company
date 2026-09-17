-- Restrict data access to real, authenticated, allow-listed users.
-- Replaces the permissive local-dev policies from the init migration now
-- that the app authenticates through Supabase Auth (Google ID token)
-- instead of trusting a client-decoded JWT.

create table if not exists authorized_users (
  email text primary key
);

insert into authorized_users (email) values
  ('ramiro@ark-ti.com'),
  ('ramiro@wembii.com'),
  ('ramiroanastasi@gmail.com')
on conflict (email) do nothing;

alter table authorized_users enable row level security;

create policy "authorized_users_select_self" on authorized_users
  for select to authenticated
  using (true);

drop policy if exists "companies_select" on companies;
drop policy if exists "movements_select" on movements;
drop policy if exists "movements_insert" on movements;
drop policy if exists "movements_update" on movements;
drop policy if exists "movements_delete" on movements;

create policy "companies_select_authorized" on companies
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from authorized_users));

create policy "movements_select_authorized" on movements
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from authorized_users));

create policy "movements_insert_authorized" on movements
  for insert to authenticated
  with check (auth.jwt() ->> 'email' in (select email from authorized_users));

create policy "movements_update_authorized" on movements
  for update to authenticated
  using (auth.jwt() ->> 'email' in (select email from authorized_users));

create policy "movements_delete_authorized" on movements
  for delete to authenticated
  using (auth.jwt() ->> 'email' in (select email from authorized_users));
