-- New design, Support "New Ticket": the category select had no column, so the
-- implementation prefixed the chosen value into the ticket body as
-- "Category: X\n\n...". That made it invisible to filtering and reporting, and
-- it polluted the first line of every ticket support staff read.
--
-- Free text rather than an enum: the category list is presentational and will
-- change as the product does, and an enum would need a migration every time.
-- The application supplies the values.
alter table public.support_tickets
  add column if not exists category text;

comment on column public.support_tickets.category is
  'Optional triage category chosen by the reporter (Billing, Technical, Account). Set by the app, not constrained here.';

-- Support staff filter by category within a status, so index it alongside status.
create index if not exists support_tickets_category_idx
  on public.support_tickets (category)
  where category is not null;
