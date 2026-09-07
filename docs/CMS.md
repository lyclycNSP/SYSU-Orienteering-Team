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

- “定向入门”：可独立新建多篇教程，源文件位于 `content/tutorials/`，生成 `team/tutorials/文件名.html`，归入首页“定向入门”筛选。原有手记中的“入门资料”在构建时兼容显示为“定向入门”，旧文章网址不变。

正文上方可切换“富文本 / Markdown”，两种模式均有快捷工具栏。富文本沿用 Decap 原生操作；Markdown 模式直接在选区或光标处插入语法，支持加粗、斜体、删除线、标题、列表、引用、代码、链接、图片和附件。图片/附件按钮打开同一个媒体库，选择后自动插入链接，并支持未发布图片的右侧预览。

Markdown 模式支持撤销/重做以及 Ctrl/Cmd+B、I、Z 快捷键。切换模式会清空该模式的撤销记录，但保留当前正文；富文本转换可能统一空行等 Markdown 写法，特殊语法建议始终使用 Markdown 模式。编辑器扩展位于 `admin/markdown-editor.js`，没有修改 Decap 核心文件。

- “比赛故事”：填写标题、摘要、正文等。封面可上传插图或照片，建议横图。首页裁剪铺满卡片顶部，正文页显示完整比例。空封面保留等高线图案。
- “规章制度”：像手记一样新建多篇文章。`/team/rules/` 展示规程列表，首页有“规章制度”筛选。原规程内容完整保留为一篇文章，文件仍在 `content/rules/index.md`，阅读地址为 `/team/rules/doc-index.html`；新文章使用 `doc-文件名.html`。
- “资料下载 → 下载资料列表”：添加、删除、排序资料条目，填写名称和说明，用“文件”字段上传 PDF、Word 等附件。原指南和 IOF 下载入口继续保留。
- 正文使用富文本模式时，可在“添加组件（＋）→ 附件 / PDF预览”中选择文件；最终保存为普通 Markdown 链接，也可以手动写 `[查看资料](<uploads/文件名.pdf>)`。
- Markdown 支持标题、列表、表格、链接、图片；内嵌 HTML 按文本显示。新图片路径为 `uploads/...`；旧 `/uploads/...` 路径仍受支持。不要手动将草稿图片改成线上完整网址。
- 点击发布后，Markdown 和上传文件写入 GitHub，GitHub Pages 自动构建；仅内容和媒体变化时 Netlify 跳过构建。文章默认在网站显示，发布内容存于公开仓库，不可用来保存私密内容。删除文章后 Pages 构建也会移除对应网页。
- 后台右侧采用队伍网站字体、配色和正文样式，支持封面和正文图片的即时预览；最终导航和首页卡片以构建后的网站为准。
- 图片库“草稿”表示图片还没随文章发布，不意味着不能预览。选择图片后，右侧预览通过 Decap 临时资源缓存显示；未发布前不要依赖其网站 URL。
- 示例标记和网站显示字段已隐藏，新增文章默认 `example: false`、`published: true`。无需手动切换；右侧即时预览保留，顶部部署预览链接已关闭。后台列表只显示标题，不显示历史子分类。

## 文件分工

- `README.md`：指南内容来源。修改后执行 `node scripts/update-guide.mjs` 同步指南正文到根 `index.html`，保留页面框架和目录。普通构建不会自动改写指南。更新 PDF 时先构建并通过浏览器打印生成，打印样式为 `assets/guide-print.css`；确保 PDF 中相对链接转换为 GitHub Pages 正式网址，检查图例、分页与链接后替换原同名 PDF，再构建发布。
- `assets/team-logo.svg`：首页使用的队徽原始 SVG。

- `admin/`：后台及字段配置，不含密钥。
- `content/posts/*.md`：文章源文件。示例地址继续使用 `training-example.html` 和 `race-example.html`。
- `content/rules/*.md`：多篇规程源文件。
- `content/resources.yml`：下载页标题、简介和有序文件列表。
- `uploads/`：封面、正文图片和附件。
- `templates/`：首页及文章布局；首页文案在这里修改。
- `team/style.css`、`team/content.css`：队伍栏目样式。
- `scripts/build.mjs`：只写入生成目录 `_site/`，不修改指南。
- `package-lock.json`：锁定 Markdown、YAML 和 Decap 后台构建依赖。

旧 `team/index.html`、`team/posts/`、`team/rules/index.html`、`team/resources.html` 保留，不再作为新构建的内容来源。部署使用 `_site/`，它只包含对读者公开的网站文件。后台样式和预览分别在 `admin/admin.css`、`admin/preview.css`、`admin/preview.js`；媒体窗口在 `scripts/cms-entry.jsx`，由构建器打包。

参考：[Decap GitHub backend](https://decapcms.org/docs/github-backend/)。


## 栏目、搜索与访问入口（新版）

后台直接分为比赛故事、规章制度、定向入门、名单公示和资料下载。名单公示源文件位于 `content/notices/`。原训练回顾/比赛故事在构建时归入比赛故事，保留 `team/posts/` 文章网址；不删除或重写既有文章正文。

四类文章列表分别为 `team/culture/`、`team/rules/`、`team/tutorials/`、`team/notices/`。首页标题为中山大学定向队，文章区为最新发布。所有队伍页面通过构建器共用页头、队徽和导航；手机端点击菜单展开。

首页搜索框同时匹配已发布文章的标题、摘要与正文，可输入多个以空格分隔的关键词（需全部匹配），并叠加栏目筛选。结果展示匹配摘要；不解析图片、PDF、Word 附件内容。搜索在浏览器本地运行，不需要第三方服务。

GitHub Pages 的 `/admin/` 根据域名自动跳转到 Netlify 后台；Netlify 的阅读页通过 `_redirects` 转到 GitHub Pages，对原有无 .html 的文章网址生成兼容跳转。后台及上传资源不使用全站通配跳转，避免影响登录和图片预览。Pages 的根指南内容仍原样复制。

发布验证应看 GitHub Pages。Netlify 因仅内容更新跳过构建是预期状态；示例文章也会触发 Pages，已经替换成真实内容的旧示例无需删除。

空图片占位（例如 Markdown 的 ![]()）在发布页面忽略，在右侧预览提示补选或删除，不再阻断整站构建。非空非法路径仍报错。Decap 3.16 可能残留部署预览等待按钮，admin/ui.js 仅隐藏对应按钮，保留即时预览开关。

定向入门中的 member-guide.md 是 README 指南的独立副本，封面及图例已归入该文章的附件目录，可在后台编辑；首页已取消硬编码跳转卡片。修改该文章不会同步改动根指南、README 或 PDF。原指南入口继续保留。

## 媒体整理与附件预览

- 新媒体窗口有“当前文章 / 公共素材 / 全部文件”，支持文件名、目录搜索和图片/文档筛选。图片字段只能选图片。
- 在文章中上传，默认保存到 `uploads/articles/栏目/文章标识/`。首次上传时自动记录隐藏字段 `media_id`，改标题不会改变目录。切换“公共素材”后上传则保存到 `uploads/resources/`；下载资料列表和独立媒体入口默认使用此目录。
- 文件名自动追加短编号，不覆盖旧同名文件；单文件上限 25 MB。正文已引用的图片也会在“当前文章”显示。未引用旧文件从“全部文件”选择；`.gitkeep` 等目录占位文件不显示。
- 编辑文章或下载列表时，文件以草稿暂存，可立即选取和预览，随内容发布提交；从独立媒体入口上传则直接写入仓库。
- 两种入口均可“删除所选文件”。删除草稿只移除该附件；删除已保存文件会立即提交到仓库，不会自动移除文章中的引用。确认框会提示影响。若只想从文章移除图片，应在正文操作，不要删除素材文件。
- PDF 链接在新标签页打开，另附下载入口；浏览器或手机设置仍可能将 PDF 下载。后台草稿 PDF 使用临时 Blob 地址，不需要先发布。
- DOC/DOCX 保留原件下载。要在线查看，另传 PDF：富文本附件组件填写“PDF 预览版”，下载列表填写“PDF 预览版”；Markdown 模式依次插入原件和 PDF 两个链接。不会自动转换 Word，也不向第三方阅读服务传送文件。
- 原件和 PDF 预览版成对插入时只显示两条链接，不再分别追加下载按钮；单独 PDF 链接仍附一个下载入口。

2026-09-07 经用户授权，迁移了 10 篇文章引用的 22 张旧图片：20 张归入文章目录，2 张共用图片归入 `uploads/resources/`。文章只更新图片引用和隐藏的 `media_id`，未改正文内容。未引用图片和现有文档附件未迁移。清单与原文件 SHA-256 位于 `config/media-aliases.json`；`scripts/migrate-media.mjs` 默认只输出计划，`--apply` 才执行有路径边界检查的迁移。

构建器根据清单在输出目录保留旧图片网址的兼容副本，仓库不保留重复文件。显式删除新路径图片后，构建也不再生成该旧网址副本；删除文件不会因为兼容清单而阻断构建。

### 后台构建与维护

`npm run build` 先生成静态页面，再用 esbuild 打包锁定的 Decap 3.16.0（core 3.18.0）和媒体窗口，生成 `_site/admin/vendor/cms.js`。原后台通过 CDN 加载，现在使用同站点文件；身份认证与文章发布仍走 Decap 的 GitHub backend。

`scripts/cms-compat.mjs` 对锁定源码做两个窄适配：保留 `uploads/` 下的完整路径，防止保存时压平目录；GitHub 媒体列表递归读取子目录。匹配点改变会使构建明确失败。不要直接编辑 node_modules 或生成文件；升级 Decap 时需重新验证上传、草稿、插入、发布和重新打开。

依赖安装的 peer 警告来自 Decap 依赖对 React 的旧版本声明。本次 `npm audit` 报告的高危链源于上游 immutable 与 trim 的拒绝服务公告；没有执行会跨版本升级编辑器的 `npm audit fix --force`。依赖升级应作为独立兼容性工作处理。后台只供有仓库写权限的编辑使用，前台不加载 CMS 包。
