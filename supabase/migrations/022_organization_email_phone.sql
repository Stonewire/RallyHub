-- Organization contact email and phone for SuperAdmin client management.

alter table public.organizations
  add column if not exists email text,
  add column if not exists phone text;

update public.organizations
set email = contact_email
where email is null
  and contact_email is not null;
