-- Allow Word documents as lyrics / sheet-music attachments (idempotent)
--
-- The song-attachments bucket enforces an allowed_mime_types allowlist, so the
-- file picker's accept="" attribute is only a hint — without these two entries
-- a .doc/.docx upload is rejected by Storage after the user has already chosen
-- the file.
--
--   .docx -> application/vnd.openxmlformats-officedocument.wordprocessingml.document
--   .doc  -> application/msword
--
-- Rewrites the whole array rather than appending so the result is identical
-- however many times this runs.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/octet-stream',         -- .mxl (compressed MusicXML)
      'text/xml',
      'application/xml',
      'application/vnd.recordare.musicxml+xml'
    ]
WHERE id = 'song-attachments';
