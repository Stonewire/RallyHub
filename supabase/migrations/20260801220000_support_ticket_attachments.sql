-- Ticket file attachments: the "Upload a File" button on the support form has
-- existed as a disabled control since the redesign. This makes it real.
--
-- PRIVATE bucket, unlike every other bucket in this app. Support tickets are
-- where people paste screenshots of whatever just went wrong, which routinely
-- means participant names, email addresses or a half-finished event. A public
-- bucket would make each of those readable by URL to anyone who ever saw it,
-- forever. Reads go through short-lived signed URLs instead.
--
-- image/svg+xml is excluded for the same reason as the other buckets: an SVG is
-- a script-bearing document, and support staff open these attachments while
-- signed in. PDF is allowed because it is the format people actually attach.
--
-- Attachments are stored as jsonb on the ticket rather than in their own table.
-- They have no independent lifecycle: they are created with the ticket, read
-- with the ticket, and die with the ticket. A table would add a second set of
-- RLS policies expressing the same rule the ticket policy already expresses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760, -- 10MB
  array[
    'image/jpeg','image/pjpeg','image/png','image/webp','image/avif',
    'application/pdf','text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.support_tickets
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.support_tickets.attachments is
  'Array of {path, name, size, type}. path is the object key in the private '
  '"support-attachments" bucket; read it with a signed URL, never a public one.';

-- Objects are keyed "<organization_id>/<uuid>-<filename>". Every policy checks
-- the leading folder against the caller's organisation, so one client can never
-- reach another client's attachments, and support staff (super_admin) can reach
-- all of them because answering the ticket requires seeing what was attached.
drop policy if exists "support_attachments_read" on storage.objects;
create policy "support_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (select public.is_super_admin())
      or (storage.foldername(name))[1] = (select public.user_organization_id())::text
    )
  );

drop policy if exists "support_attachments_insert" on storage.objects;
create policy "support_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = (select public.user_organization_id())::text
  );

-- Deliberately no UPDATE policy: an attachment is evidence of what someone
-- reported at the time, so it is written once and never overwritten in place.
drop policy if exists "support_attachments_delete" on storage.objects;
create policy "support_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (select public.is_super_admin())
      or (storage.foldername(name))[1] = (select public.user_organization_id())::text
    )
  );
