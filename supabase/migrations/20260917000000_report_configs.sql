create table if not exists report_configs (
  id bigint generated always as identity primary key,
  email text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week int,
  day_of_month int,
  hour int not null default 8,
  company text not null default 'Todas las empresas',
  include_summary boolean not null default true,
  include_movements boolean not null default true,
  include_monthly boolean not null default true,
  include_distribution boolean not null default true,
  include_trend boolean not null default true,
  include_top_expenses boolean not null default true,
  created_at timestamptz not null default now()
);

alter table report_configs enable row level security;

create policy "report_configs_all_authorized" on report_configs
  for all to authenticated
  using (auth.jwt() ->> 'email' in (select email from authorized_users))
  with check (auth.jwt() ->> 'email' in (select email from authorized_users));
