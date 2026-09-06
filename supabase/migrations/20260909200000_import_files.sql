-- Recipe imports go through the private bucket now (one object per file under
-- <household>/imports/), so the bucket must accept documents, not just photos.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'text/html', 'application/octet-stream'
],
file_size_limit = 12 * 1024 * 1024
where id = 'recipe-photos';
