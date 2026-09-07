# 队伍栏目维护与后台接入

根目录 `index.html` 是原指南，构建时原样复制；不通过 CMS 编辑。指南 README 和 PDF 没有转换。

## 本地预览

在仓库根目录执行：

```powershell
npm ci
npm test
npm run build
python -m http.server 8766 --bind 127.0.0.1 --directory _site
```

打开 http://127.0.0.1:8766/team/ 。原有 8765 预览可继续使用；新结构以 `_site` 构建结果为准，不再直接预览仓库根目录的旧文章 HTML。修改 Markdown 或模板后重新运行 `npm run build`。

## 首次上线配置

本次接入文件须先提交、推送，才会在 Netlify 和 GitHub 生效。

1. GitHub 仓库 → Settings → Pages → Build and deployment → Source，选择 **GitHub Actions**。地址仍是原来的项目地址，根页面仍是指南。`.github/workflows/pages.yml` 负责测试、生成和发布 `_site`；不需要提交生成的 HTML。
2. Netlify 使用同一个仓库、`main` 分支。根目录 `netlify.toml` 设置构建命令 `npm run build`、发布目录 `_site`、Node 22。不要继续以 `.` 作为发布目录。
3. Netlify 项目安装 GitHub OAuth Provider 后，打开 **该 Netlify 域名后加 `/admin/`**，点击 GitHub 登录。无需注册 Decap 账号，也不需要启用 Identity / Git Gateway。
4. GitHub OAuth App 回调为 `https://api.netlify.com/auth/done`；Client Secret 只保存在 Netlify 的 OAuth Provider 中，不写进 `admin/config.yml`。默认使用当前 Netlify 域名识别 OAuth 站点，所以先在 Netlify 的 `/admin/` 登录。
5. 在 GitHub 仓库 Settings → Collaborators 邀请编辑同学并授予写入权限，同学接受邀请后，用自己的 GitHub 账号登录后台。此权限是仓库写入权限，并非仅限文章。

首次部署后台后，用有权限的账号登录、修改并发布示例文章，确认 GitHub 出现提交、Pages Actions 构建成功、GitHub Pages 文章更新。仅内容变更时 Netlify 应跳过构建。后台页面可以公开访问，写入仍需 GitHub 授权。

## Netlify 构建额度优化

`netlify.toml` 的 `ignore` 命令运行 `scripts/netlify-ignore.mjs`，比较 Netlify 的 `CACHED_COMMIT_REF` 与 `COMMIT_REF`。仅 `content/`、`uploads/` 有变化（或无变化）时退出 0，跳过 Netlify 构建；其他文件变化、首次部署或 Git 历史不可用时退出 1，正常构建。脚本无需安装依赖。重命名同时检查原路径和新路径，避免漏掉后台文件移出。

GitHub Pages 仍响应 main 的所有提交。Decap 通过 GitHub 后端读写文章和媒体，无需部署 Netlify 即可继续编辑；文章、规程和下载页请在 GitHub Pages 阅读，Netlify 副本在下次实际部署前保持旧内容。后台访问仍产生请求和流量额度。

规则提交并推送后才生效，本次配置更新会正常部署一次。后续内容提交可能显示 Netlify 构建取消/跳过，这是预期行为。Netlify Build Hook 触发的构建不受 ignore 命令取消控制，不要另设每次发布文章调用 Build Hook 的流程。参考：[Netlify Ignore builds](https://docs.netlify.com/build/configure-builds/ignore-builds/)。

## 日常编辑

正文上方可切换“富文本 / Markdown”，两种模式均有快捷工具栏。富文本沿用 Decap 原生操作；Markdown 模式直接在选区或光标处插入语法，支持加粗、斜体、删除线、标题、列表、引用、代码、链接、图片和附件。图片/附件按钮打开同一个媒体库，选择后自动插入链接，并支持未发布图片的右侧预览。

Markdown 模式支持撤销/重做以及 Ctrl/Cmd+B、I、Z 快捷键。切换模式会清空该模式的撤销记录，但保留当前正文；富文本转换可能统一空行等 Markdown 写法，特殊语法建议始终使用 Markdown 模式。编辑器扩展位于 `admin/markdown-editor.js`，没有修改 Decap 核心文件。

- “队伍手记”：填写标题、摘要、正文等。封面可上传插图或照片，建议横图。首页裁剪铺满卡片顶部，正文页显示完整比例。空封面保留等高线图案。
- “队伍规程”：像手记一样新建多篇文章。`/team/rules/` 展示规程列表，首页有“队伍规程”筛选。原规程内容完整保留为一篇文章，文件仍在 `content/rules/index.md`，阅读地址为 `/team/rules/doc-index.html`；新文章使用 `doc-文件名.html`。
- “资料下载 → 下载资料列表”：添加、删除、排序资料条目，填写名称和说明，用“文件”字段上传 PDF、Word 等附件。原指南和 IOF 下载入口继续保留。
- 正文使用富文本模式时，可在“添加组件（＋）→ 附件下载”中选择文件；最终保存为普通 Markdown 链接，也可以手动写 `[下载资料](<uploads/文件名.pdf>)`。
- Markdown 支持标题、列表、表格、链接、图片；内嵌 HTML 按文本显示。新图片路径为 `uploads/...`；旧 `/uploads/...` 路径仍受支持。不要手动将草稿图片改成线上完整网址。
- 点击发布后，Markdown 和上传文件写入 GitHub，GitHub Pages 自动构建；仅内容和媒体变化时 Netlify 跳过构建。关闭“在网站显示”会隐藏文章，但文件仍在公开仓库中，不可用来保存私密内容。删除文章后 Pages 构建也会移除对应网页。
- 后台右侧采用队伍网站字体、配色和正文样式，支持封面和正文图片的即时预览；最终导航和首页卡片以构建后的网站为准。
- 图片库“草稿”表示图片还没随文章发布，不意味着不能预览。选择图片后，右侧预览通过 Decap 临时资源缓存显示；未发布前不要依赖其网站 URL。
- “标记为示例文章”只添加“排版示例 / 非真实活动报道”字样，正式文章请关闭；它不影响是否发布，也不等同于草稿状态。

## 文件分工

- `admin/`：后台及字段配置，不含密钥。
- `content/posts/*.md`：文章源文件。示例地址继续使用 `training-example.html` 和 `race-example.html`。
- `content/rules/*.md`：多篇规程源文件。
- `content/resources.yml`：下载页标题、简介和有序文件列表。
- `uploads/`：封面、正文图片和附件。
- `templates/`：首页及文章布局；首页文案在这里修改。
- `team/style.css`、`team/content.css`：队伍栏目样式。
- `scripts/build.mjs`：只写入生成目录 `_site/`，不修改指南。
- `package-lock.json`：锁定 Markdown、YAML 解析依赖。使用成熟解析器，避免自制解析器遗漏常见语法。

旧 `team/index.html`、`team/posts/`、`team/rules/index.html`、`team/resources.html` 保留，不再作为新构建的内容来源。部署使用 `_site/`，它只包含对读者公开的网站文件。后台样式和预览分别在 `admin/admin.css`、`admin/preview.css`、`admin/preview.js`，不需要修改 Decap 核心代码。

参考：[Decap GitHub backend](https://decapcms.org/docs/github-backend/)。
