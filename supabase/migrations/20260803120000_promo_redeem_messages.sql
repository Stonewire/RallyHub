-- Promo redemption: say which thing went wrong.
--
-- redeem_promo_code lumped "no such code" together with "this code has been
-- switched off" into one "Invalid or inactive promo code", so a client who
-- typed the code correctly could not tell a typo from a code we had retired,
-- and neither could support. Every other failure in this function already
-- names itself; these two did not.
--
-- Logic is unchanged. Only the messages differ.

create or replace function public.redeem_promo_code(p_code text)
returns public.promo_code_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_code public.promo_codes%rowtype;
  v_redemption public.promo_code_redemptions%rowtype;
  v_norm text := lower(trim(coalesce(p_code, '')));
begin
  if v_norm = '' then
    raise exception 'Enter a promo code';
  end if;

  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization for this account';
  end if;

  select * into v_code from public.promo_codes where lower(code) = v_norm;
  if not found then
    raise exception 'We do not have a promo code with that name. Check the spelling and try again';
  end if;
  if not v_code.is_active then
    raise exception 'That promo code is no longer active';
  end if;

  if v_code.max_redemptions is not null
     and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'This promo code has reached its redemption limit';
  end if;

  if exists (
    select 1 from public.promo_code_redemptions
    where promo_code_id = v_code.id and organization_id = v_org
  ) then
    raise exception 'This promo code is already on your account';
  end if;

  insert into public.promo_code_redemptions (
    promo_code_id, organization_id, purpose, discount_percent, duration_months
  ) values (
    v_code.id, v_org, v_code.purpose, v_code.discount_percent, v_code.duration_months
  ) returning * into v_redemption;

  update public.promo_codes
  set redemption_count = redemption_count + 1
  where id = v_code.id;

  return v_redemption;
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;
