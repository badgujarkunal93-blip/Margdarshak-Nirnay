create table if not exists public.cap_lists (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  counsellor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cap_list_items (
  id uuid primary key default gen_random_uuid(),
  cap_list_id uuid not null references public.cap_lists(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  branch text not null,
  priority_order integer not null,
  safety_label text not null check (safety_label in ('SAFE', 'MODERATE', 'REACH')),
  notes text
);

alter table public.group_invites
  add column if not exists is_active boolean not null default true;

alter table public.students
  add column if not exists updated_at timestamptz not null default now();

create index if not exists cap_lists_student_id_idx on public.cap_lists(student_id);
create index if not exists cap_list_items_list_order_idx on public.cap_list_items(cap_list_id, priority_order);

alter table public.cap_lists enable row level security;
alter table public.cap_list_items enable row level security;

-- For production, replace these broad authenticated policies with an admin role claim.
create policy "Authenticated admins can manage cap lists"
  on public.cap_lists for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated admins can manage cap list items"
  on public.cap_list_items for all
  to authenticated
  using (true)
  with check (true);
