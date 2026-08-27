-- FIX-ROUND-1 P5.1: Paddle refunds of event payments mark the invoice
-- 'refunded' (written by the paddle-webhook adjustment handler).
--
-- Current constraint comes from 027_event_invoices.sql as an inline check,
-- auto-named invoices_status_check:
--   status text not null check (status in ('unpaid', 'paid', 'comped'))
-- This recreates it with 'refunded' added. Additive: every existing row
-- still satisfies the new constraint.

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('unpaid', 'paid', 'comped', 'refunded'));

comment on column public.invoices.status is
  'unpaid | paid | comped | refunded. refunded is set by the Paddle webhook when an approved refund adjustment references the invoice''s transaction.';
