// Repository-relative paths only. Old uploads remain valid and are never moved.
export function uploadPath(value) {
  let path;
  try { path = decodeURIComponent(String(value)); } catch { return null; }
  path = path.replace(/^\/(?:SYSU-Orienteering-Team\/)?/, '');
  if (!path.startsWith('uploads/') || /[\\?#%\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) return null;
  return path;
}

export function mediaKind(path) {
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|tiff?)$/i.test(path)) return 'image';
  return 'document';
}

export function articleFolder(collection, id) {
  if (!['posts', 'rules', 'tutorials', 'notices'].includes(collection) || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('无效的文章附件目录');
  return `uploads/articles/${collection}/${id}`;
}

export function uniqueName(name, id) {
  const safe = String(name).normalize('NFKC').replace(/[\\/<>:"|?*#%\x00-\x1f]/g, '-').replace(/^\.+/, '').slice(-140);
  const match = safe.match(/^(.*?)(\.[a-zA-Z0-9]{1,10})?$/);
  return `${match[1] || 'file'}-${id.replace(/[^a-zA-Z0-9-]/g, '')}${(match[2] || '').toLowerCase()}`;
}

export function filterMedia(files, { scope, folder, references = [], type = 'all', query = '', imagesOnly = false }) {
  const refs = new Set(references.map(uploadPath).filter(Boolean));
  const words = query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return files.filter(file => {
    const path = uploadPath(file.path);
    if (!path) return false;
    if (scope === 'article' && !(folder && path.startsWith(folder + '/')) && !refs.has(path)) return false;
    if (scope === 'shared' && !path.startsWith('uploads/resources/')) return false;
    const kind = mediaKind(path);
    if ((imagesOnly && kind !== 'image') || (type !== 'all' && kind !== type)) return false;
    return words.every(word => path.normalize('NFKC').toLowerCase().includes(word));
  });
}

export function referencedUploads(data) {
  // Includes links with spaces, encoded paths, covers and paired PDF previews.
  const result = [];
  function walk(value) {
    if (typeof value === 'string') {
      if (uploadPath(value)) result.push(uploadPath(value));
      for (const match of value.matchAll(/(?:^|[\s(<"'])((?:\/(?:SYSU-Orienteering-Team\/)?)?uploads\/[^\n<>"')]+)(?=[)>"']|$)/g)) {
        const path = uploadPath(match[1]);
        if (path) result.push(path);
      }
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  }
  walk(data);
  return [...new Set(result)];
}
