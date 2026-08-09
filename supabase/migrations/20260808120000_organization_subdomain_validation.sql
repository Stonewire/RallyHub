-- Reserved-word + format validation for organizations.subdomain, enforced at
-- the DB layer so it covers every write path (register-client, create-client,
-- and the super-admin rename in use-rallyhub.ts), none of which validate this
-- today. Confirmed via query that all 7 existing subdomains already pass.
create or replace function public.validate_organization_subdomain()
returns trigger
language plpgsql
as $$
declare
  reserved text[] := array[
    'login','register','privacy','terms','dpa','imprint','cookies','contact',
    'play','tablet','join','display','facilitator','events','app','admin',
    'api','assets','www'
  ];
begin
  if new.subdomain is null then
    return new;
  end if;

  if new.subdomain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'Subdomain must be lowercase letters, numbers, and hyphens only, and cannot start or end with a hyphen.';
  end if;

  if new.subdomain = any(reserved) then
    raise exception 'Subdomain "%" is reserved and cannot be used.', new.subdomain;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_validate_subdomain on public.organizations;
create trigger organizations_validate_subdomain
  before insert or update of subdomain on public.organizations
  for each row execute function public.validate_organization_subdomain();

comment on function public.validate_organization_subdomain() is
  'Rejects reserved-word or malformed organization subdomains on insert or rename. Single enforcement point covering every write path.';
