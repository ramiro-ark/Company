create table if not exists companies (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists movements (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  month text not null,
  type text not null check (type in ('income', 'expense', 'investment')),
  description text not null,
  amount numeric not null,
  currency text not null default 'CLP' check (currency in ('CLP', 'USD')),
  status text not null default 'Pendiente' check (status in ('Pagado', 'Pendiente')),
  payment_method text,
  card text,
  created_at timestamptz not null default now()
);

create index if not exists movements_company_month_type_idx on movements (company_id, month, type);

alter table companies enable row level security;
alter table movements enable row level security;

-- Local development policies: open to the anon key since access is already
-- gated by Google Sign-In in the app UI. Replace with policies scoped to
-- Supabase Auth (auth.uid()/auth.email()) before exposing this project online.
create policy "companies_select" on companies for select using (true);
create policy "movements_select" on movements for select using (true);
create policy "movements_insert" on movements for insert with check (true);
create policy "movements_update" on movements for update using (true);
create policy "movements_delete" on movements for delete using (true);
