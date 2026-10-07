import { mediaMimeType } from './media-types.mjs';

// These narrow adapters are tied to the locked Decap version. Fail the build
// if upstream changes the call sites, rather than silently flattening filenames.
export function patchSelectors(source) {
  for (const signature of [
    'export function selectMediaFilePath(config, collection, entryMap, mediaPath, field) {',
    'export function selectMediaFilePublicPath(config, collection, mediaPath, entryMap, field) {'
  ]) {
    if (!source.includes(signature)) throw new Error('Decap 附件路径适配点已变化，请重新验证');
    source = source.replace(signature, signature + `
  if (typeof mediaPath === 'string' && mediaPath.startsWith('uploads/')) {
    // Editor URLs may encode Chinese names and spaces; draft keys do not.
    // Decode once, then validate so encoded traversal remains forbidden.
    try { mediaPath = decodeURIComponent(mediaPath); }
    catch { throw new Error('Invalid upload path'); }
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

export function patchMediaTypes(source) {
  const options = `const options = name.match(/.svg$/) ? {
    type: 'image/svg+xml'
  } : {};`;
  const blobReturn = '  return blob;';
  if (!source.includes(options) || !source.includes(blobReturn)) throw new Error('Decap 媒体类型适配点已变化，请重新验证');
  return `const teamMediaMimeType = ${mediaMimeType.toString()};\n` + source
    .replace(options, 'const options = { type: teamMediaMimeType(name) || blob.type };')
    .replace(blobReturn, '  const type = teamMediaMimeType(path);\n  return type && blob.type !== type ? new Blob([blob], { type }) : blob;');
}
