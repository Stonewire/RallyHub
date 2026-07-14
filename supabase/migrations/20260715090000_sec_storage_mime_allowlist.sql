-- SEC: restrict what content types can be uploaded to the two PUBLIC buckets.
--
-- Both buckets were public with allowed_mime_types = NULL, and the content type is
-- supplied by the CLIENT (storage.ts passes `contentType: file.type`). The
-- `accept="image/*"` attribute on the file inputs is browser-side only and trivially
-- bypassed. So a participant holding nothing but an event join link could upload a
-- text/html page, or a script-bearing image/svg+xml, and have Supabase serve it
-- publicly.
--
-- This is NOT the classic "upload a .php shell" bug — these are object stores, there
-- is no PHP or any runtime that executes a stored file, so a .php there is inert
-- bytes. The real exposure is different: an attacker-controlled page hosted on the
-- project's own Supabase origin (phishing/malware), and a same-origin stored XSS the
-- day storage is ever served from a rallyhub.games custom domain.
--
-- The allowlist is deliberately GENEROUS across iPhone AND Android capture formats,
-- because rejecting a legitimate upload mid-event is worse than the risk we are
-- closing: HEIC/HEIF and .mov (iOS), 3GPP/3GP2, MKV, AMR, WEBM (Android), plus AVIF,
-- BMP, TIFF.
--
-- application/octet-stream is included ON PURPOSE. Some Android browsers send it when
-- they cannot determine a type, and rejecting it would break a real upload. It is safe
-- here because browsers DOWNLOAD octet-stream — they never render or execute it. The
-- types the attack actually needs (text/html, image/svg+xml, xhtml, javascript) are
-- precisely the ones left out.
update storage.buckets
set allowed_mime_types = array[
      -- images (iOS + Android + desktop)
      'image/jpeg','image/pjpeg','image/png','image/webp','image/gif',
      'image/heic','image/heif','image/heic-sequence','image/heif-sequence',
      'image/avif','image/bmp','image/tiff',
      -- video (iOS .mov/quicktime, Android mp4/3gp/mkv/webm)
      'video/mp4','video/quicktime','video/webm','video/x-m4v',
      'video/3gpp','video/3gpp2','video/x-matroska','video/mpeg',
      -- audio (music catalog, plus Android voice recordings)
      'audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/aac',
      'audio/wav','audio/x-wav','audio/wave','audio/vnd.wave',
      'audio/flac','audio/x-flac','audio/ogg','audio/vorbis','audio/webm',
      'audio/3gpp','audio/amr',
      -- safety valve: downloads, never renders. Prevents a mid-event break.
      'application/octet-stream'
    ]
where id = 'game-assets';

-- Logos are admin-only, so this can be tighter. It also had NO server-side size cap
-- at all (file_size_limit was NULL) — the 15MB limit in the app is client-side only.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg','image/pjpeg','image/png','image/webp','image/gif',
      'image/avif','image/bmp'
    ],
    file_size_limit = 15728640 -- 15MB, matching UPLOAD_MAX_PHOTO_BYTES
where id = 'organization-logos';
