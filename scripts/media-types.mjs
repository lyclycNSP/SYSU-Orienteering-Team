export function mediaMimeType(path) {
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', pdf: 'application/pdf' };
  return types[String(path).split('.').pop().toLowerCase()] || '';
}
