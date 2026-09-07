import CMS from 'decap-cms-app';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import createClass from 'create-react-class';
import { Map as ImmutableMap } from 'immutable';
import { store } from 'decap-cms-core/dist/esm/redux';
import { currentBackend } from 'decap-cms-core/dist/esm/backend';
import { addAsset } from 'decap-cms-core/dist/esm/actions/media';
import { addDraftEntryMediaFile, changeDraftField } from 'decap-cms-core/dist/esm/actions/entries';
import { loadMedia, loadMediaDisplayURL, mediaPersisted, closeMediaLibrary, insertMedia } from 'decap-cms-core/dist/esm/actions/mediaLibrary';
import { createAssetProxy } from 'decap-cms-core/dist/esm/valueObjects/AssetProxy';
import { getBlobSHA } from 'decap-cms-lib-util';
import { articleFolder, uniqueName, filterMedia, referencedUploads, mediaKind, uploadPath } from './media-policy.mjs';
import * as attachments from './attachments.mjs';

window.CMS = CMS;
window.h = React.createElement;
window.createClass = createClass;
window.TeamAttachments = attachments;

function MediaLibrary({ close }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const entry = state.entryDraft.get('entry');
  const collection = entry?.get('collection');
  const hasArticle = ['posts', 'rules', 'tutorials', 'notices'].includes(collection);
  const data = entry?.get('data')?.toJS() || {};
  const folder = hasArticle && data.media_id ? articleFolder(collection, data.media_id) : null;
  const library = state.mediaLibrary;
  const imagesOnly = library.get('forImage');
  const canInsert = library.get('canInsert');
  const [scope, setScope] = useState(hasArticle ? 'article' : 'shared');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(60);
  const dialog = useRef();
  const previousFocus = useRef(document.activeElement);
  const files = [...new Map([...(library.get('files') || []), ...(entry?.get('mediaFiles')?.toJS() || [])].map(file => [file.path, file])).values()];
  const visible = filterMedia(files, { scope, folder, references: referencedUploads(data), type, query, imagesOnly });
  const chosen = visible.find(file => file.path === selected);

  useEffect(() => {
    dialog.current.showModal();
    store.dispatch(loadMedia()).then(result => {
      if (result?.type === 'MEDIA_LOAD_FAILURE') setError('文件列表读取失败，请关闭窗口后重试。当前列表可能不完整。');
    }).catch(() => setError('文件列表读取失败，请关闭窗口后重试。'));
    return () => previousFocus.current?.focus();
  }, []);
  useEffect(() => { setSelected(''); setLimit(60); }, [scope, type, query]);

  async function upload(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (!incoming.length) return;
    setBusy(true); setError('');
    try {
      const useArticle = hasArticle && scope !== 'shared';
      let destination = 'uploads/resources';
      if (useArticle) {
        const id = data.media_id || crypto.randomUUID();
        if (!data.media_id) store.dispatch(changeDraftField({ field: ImmutableMap({ name: 'media_id' }), value: id, entries: [] }));
        destination = articleFolder(collection, id);
      }
      for (const input of incoming) {
        if (input.size > 25 * 1024 * 1024) throw new Error(`${input.name} 超过 25 MB，请压缩后上传。`);
        if (imagesOnly && mediaKind(input.name) !== 'image') throw new Error('这个字段只能选择图片。');
        const file = new File([input], uniqueName(input.name, crypto.randomUUID().slice(0, 8)), { type: input.type });
        const path = `${destination}/${file.name}`;
        const asset = createAssetProxy({ file, path });
        const media = { id: await getBlobSHA(file), name: file.name, path, file, size: file.size, displayURL: asset.url, url: asset.url, draft: Boolean(entry && !entry.isEmpty()) };
        // Use the same asset cache and draft publication path as Decap. No new
        // credentials, direct GitHub writes, or automatic deletion of old files.
        if (media.draft) {
          store.dispatch(addAsset(asset));
          store.dispatch(addDraftEntryMediaFile(media));
        } else {
          const saved = await currentBackend(store.getState().config).persistMedia(store.getState().config, asset);
          store.dispatch(addAsset(asset));
          store.dispatch(mediaPersisted(saved));
        }
        setSelected(path);
      }
    } catch (failure) { setError(`上传未完成：${failure.message}`); }
    finally { setBusy(false); }
  }

  function choose() {
    if (!chosen || busy) return;
    store.dispatch(insertMedia(chosen.path, library.get('field')));
    close();
  }

  return <dialog className="team-media" ref={dialog} aria-labelledby="media-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header><div><h2 id="media-title">图片与附件</h2><p>按文章整理，公共素材集中使用</p></div><button type="button" onClick={close} disabled={busy} aria-label="关闭媒体选择窗口">关闭 ×</button></header>
    <div className="media-tools">
      <div role="group" aria-label="素材范围">{[['article', '当前文章'], ['shared', '公共素材'], ['all', '全部文件']].map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} disabled={busy || (value === 'article' && !hasArticle)} onClick={() => setScope(value)}>{label}</button>)}</div>
      <label>文件类型 <select aria-label="文件类型" value={type} onChange={event => setType(event.target.value)} disabled={imagesOnly}><option value="all">全部类型</option><option value="image">图片</option><option value="document">文档与其他附件</option></select></label>
      <input type="search" placeholder="搜索文件名或目录" aria-label="搜索文件名或目录" value={query} onChange={event => setQuery(event.target.value)} />
      <label className={`media-upload ${busy ? 'disabled' : ''}`}>{busy ? '正在上传…' : '上传文件'}<input type="file" multiple accept={imagesOnly ? 'image/*' : undefined} disabled={busy} onChange={upload} /></label>
    </div>
    <p className="media-note">{hasArticle && scope !== 'shared' ? '新文件存入当前文章目录。' : '新文件存入公共素材目录。'} 上传文件名自动加短编号，避免覆盖同名文件。{entry && !entry.isEmpty() ? '草稿附件随文章发布。' : '此处上传会直接保存到仓库。'} 旧文件可在“全部文件”查找。</p>
    {error && <p role="alert" className="media-error">{error}</p>}
    {library.get('isLoading') && <p role="status">正在读取文件…</p>}
    <div className="media-grid">{visible.slice(0, limit).map(file => <MediaTile key={file.path} file={file} selected={selected === file.path} state={state} onClick={() => setSelected(file.path)} />)}</div>
    {!visible.length && <p className="media-empty">{scope === 'article' ? '当前文章暂无符合条件的附件，可上传新文件或从其他范围选择。' : '暂无符合条件的文件。'}</p>}
    {visible.length > limit && <button type="button" onClick={() => setLimit(limit + 60)}>显示更多文件</button>}
    <footer><span>{visible.length} 个文件{chosen ? ` · 已选：${chosen.name}` : ''}</span><div>{chosen && <MediaPreview file={chosen} state={state} />}<button type="button" className="media-confirm" disabled={!chosen || !canInsert || busy} onClick={choose}>插入所选文件</button></div></footer>
  </dialog>;
}

function displayURL(file, state) {
  const url = state.mediaLibrary.getIn(['displayURLs', file.id, 'url']) || (typeof file.displayURL === 'string' ? file.displayURL : '');
  return /^(blob:|https?:)/.test(url) ? url : '';
}
function MediaTile({ file, state, selected, onClick }) {
  useEffect(() => { store.dispatch(loadMediaDisplayURL(file)); }, [file.id, file.path]);
  const url = displayURL(file, state);
  return <button className="media-tile" type="button" aria-pressed={selected} onClick={onClick} title={file.path}>
    <div className="media-thumb">{mediaKind(file.path) === 'image' && url ? <img src={url} alt="" loading="lazy" /> : <span>{file.name.split('.').pop().toUpperCase()}</span>}{file.draft && <b>草稿</b>}</div>
    <strong>{file.name}</strong><small>{file.path.replace(/\/[^/]+$/, '')}</small>
  </button>;
}
function MediaPreview({ file, state }) {
  const url = displayURL(file, state);
  const viewable = attachments.isPDF(file.path) || mediaKind(file.path) === 'image';
  if (!url) return <span>预览地址加载中…</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" download={viewable ? undefined : file.name}>{viewable ? '新标签页预览 ↗' : '下载原文件 ↓'}</a>;
}

CMS.registerMediaLibrary({
  name: 'team-media',
  init() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const close = () => store.dispatch(closeMediaLibrary());
    return {
      show() { queueMicrotask(() => root.render(<MediaLibrary key={crypto.randomUUID()} close={close} />)); },
      hide() { root.render(null); },
      enableStandalone() { return true; }
    };
  }
});
