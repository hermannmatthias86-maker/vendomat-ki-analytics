-- vendomat KI Analytics – Supabase Schema
-- Run in Supabase SQL Editor

-- Users (extends auth.users)
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'customer' check (role in ('customer', 'vendomat_staff', 'super_admin')),
  customer_id uuid,
  created_at timestamptz default now()
);

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  created_at timestamptz default now()
);

-- Add FK after customers table exists
alter table users add constraint fk_users_customer foreign key (customer_id) references customers(id);

-- Uploads
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  user_id uuid references users(id),
  filename text,
  file_type text,
  status text check (status in ('processing','done','error')) default 'processing',
  report_type text,
  year int,
  created_at timestamptz default now()
);

-- Sales
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  upload_id uuid references uploads(id),
  date date,
  total_amount numeric,
  transaction_count int,
  average_receipt numeric,
  year int,
  month int,
  weekday int,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text,
  product_group_id uuid,
  total_revenue numeric,
  total_quantity int,
  year int,
  created_at timestamptz default now()
);

-- Product Groups
create table if not exists product_groups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text,
  total_revenue numeric,
  year int
);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  payment_type text,
  amount numeric,
  percentage numeric,
  year int
);

-- Employees
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text,
  total_revenue numeric,
  transaction_count int,
  year int
);

-- AI Results
create table if not exists ai_results (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  type text check (type in ('insight','recommendation','summary')),
  content text,
  created_at timestamptz default now()
);

-- Chat History
create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  user_id uuid references users(id),
  role text check (role in ('user','assistant')),
  content text,
  created_at timestamptz default now()
);

-- Settings
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  key text,
  value text
);

-- Activity Log
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  user_id uuid references users(id),
  action text,
  details jsonb,
  created_at timestamptz default now()
);

-- ==========================================
-- Row Level Security
-- ==========================================

alter table users enable row level security;
alter table customers enable row level security;
alter table uploads enable row level security;
alter table sales enable row level security;
alter table products enable row level security;
alter table product_groups enable row level security;
alter table payments enable row level security;
alter table employees enable row level security;
alter table ai_results enable row level security;
alter table chat_history enable row level security;
alter table settings enable row level security;
alter table activity_log enable row level security;

-- Helper function: get customer_id for current user
create or replace function get_my_customer_id()
returns uuid language sql security definer as $$
  select customer_id from users where id = auth.uid()
$$;

-- Policies
create policy "users_own" on users for all using (id = auth.uid());
create policy "customers_own" on customers for all using (id = get_my_customer_id());
create policy "uploads_own" on uploads for all using (customer_id = get_my_customer_id());
create policy "sales_own" on sales for all using (customer_id = get_my_customer_id());
create policy "products_own" on products for all using (customer_id = get_my_customer_id());
create policy "product_groups_own" on product_groups for all using (customer_id = get_my_customer_id());
create policy "payments_own" on payments for all using (customer_id = get_my_customer_id());
create policy "employees_own" on employees for all using (customer_id = get_my_customer_id());
create policy "ai_results_own" on ai_results for all using (customer_id = get_my_customer_id());
create policy "chat_history_own" on chat_history for all using (customer_id = get_my_customer_id());
create policy "settings_own" on settings for all using (customer_id = get_my_customer_id());
create policy "activity_log_own" on activity_log for all using (customer_id = get_my_customer_id());

-- Performance Indices
create index if not exists idx_sales_customer_year on sales(customer_id, year);
create index if not exists idx_sales_customer_month on sales(customer_id, month);
create index if not exists idx_products_customer on products(customer_id);
create index if not exists idx_uploads_customer on uploads(customer_id);
create index if not exists idx_ai_results_customer on ai_results(customer_id, type);
create index if not exists idx_chat_history_customer on chat_history(customer_id, created_at);

-- Auto-create user record on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into users (id, email, role) values (new.id, new.email, 'customer');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
