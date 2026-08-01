-- New design, My Account: Personal Details shows a phone field, and the
-- Profile Photo card shows an avatar the user can click to replace. Neither
-- had a column, so the photo card shipped as a decorative circle that did
-- nothing when clicked.
--
-- Phone lives on organizations already, but that is the ORGANISATION's contact
-- number. This is the individual user's, which is a different thing.
alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text;

comment on column public.profiles.phone is
  'Optional personal contact number for this user. Distinct from organizations.phone, which is the org contact.';
comment on column public.profiles.avatar_url is
  'Public URL of the user avatar in the user-avatars bucket. Null falls back to initials.';
