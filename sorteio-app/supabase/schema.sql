-- =====================================================
-- SISTEMA DE SORTEIO - SQL para o Supabase
-- Execute esse script no SQL Editor do Supabase
-- =====================================================

-- Tabela de Sorteios
create table if not exists raffles (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  description   text,
  prize         text not null,
  prize_image   text,
  prize_value   numeric(10,2),          -- Valor monetário do prêmio
  ticket_price  numeric(10,2),          -- Preço por bilhete
  total_tickets int not null check (total_tickets > 0),
  drawn_ticket  int,
  drawn_at      timestamptz,
  status        text not null default 'open' check (status in ('open', 'closed', 'drawn')),
  created_at    timestamptz default now()
);

-- Tabela de Bilhetes
create table if not exists tickets (
  id             uuid default gen_random_uuid() primary key,
  raffle_id      uuid references raffles(id) on delete cascade,
  ticket_number  int not null,
  buyer_name     text not null,
  buyer_doc      text not null,
  buyer_contact  text not null,
  payment_proof  text,
  status         text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  created_at     timestamptz default now(),
  unique(raffle_id, ticket_number)
);

-- Índices para performance
create index if not exists idx_tickets_raffle_id on tickets(raffle_id);
create index if not exists idx_tickets_status on tickets(status);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

alter table raffles enable row level security;
alter table tickets enable row level security;

-- Políticas para a tabela 'raffles'
create policy "Anyone can read raffles" on raffles for select using (true);
create policy "Anyone can insert raffles" on raffles for insert with check (true);
create policy "Anyone can update raffles" on raffles for update using (true);
create policy "Anyone can delete raffles" on raffles for delete using (true);

-- Políticas para a tabela 'tickets'
create policy "Anyone can read tickets" on tickets for select using (true);
create policy "Anyone can insert tickets" on tickets for insert with check (true);
create policy "Anyone can update tickets" on tickets for update using (true);
create policy "Anyone can delete tickets" on tickets for delete using (true);

-- Política: service_role pode fazer tudo (usado pelo servidor)
-- (service_role bypassa RLS automaticamente)

-- =====================================================
-- Storage Bucket para comprovantes
-- =====================================================

-- Execute no SQL Editor do Supabase:
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- Política: apenas service_role acessa os comprovantes
-- (bucket privado, acesso apenas pelo backend)
