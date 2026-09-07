// These two narrow adapters are tied to the locked Decap version. Fail the build
// if upstream changes the call sites, rather than silently flattening filenames.
export function patchSelectors(source) {
  for (const signature of [
    'export function selectMediaFilePath(config, collection, entryMap, mediaPath, field) {',
    'export function selectMediaFilePublicPath(config, collection, mediaPath, entryMap, field) {'
  ]) {
    if (!source.includes(signature)) throw new Error('Decap 附件路径适配点已变化，请重新验证');
    source = source.replace(signature, signature + `
  if (typeof mediaPath === 'string' && mediaPath.startsWith('uploads/')) {
    if (/[\\\\?#%\\x00-\\x1f]/.test(mediaPath) || mediaPath.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid upload path');
    return mediaPath;
  }`);
  }
  return source;
}
export function patchGithub(source) {
  const call = 'this.api.listFiles(mediaFolder)';
  if (!source.includes(call)) throw new Error('Decap 媒体列表适配点已变化，请重新验证');
  return source.replace(call, 'this.api.listFiles(mediaFolder, { depth: 64 })');
}
