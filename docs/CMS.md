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

首次用有权限的账号登录、修改并发布示例文章，确认 GitHub 出现提交、Actions 和 Netlify 构建成功、两端文章更新，才算完整联调完成。后台页面可以公开访问，写入仍需 GitHub 授权。

## 日常编辑

- “队伍手记”：填写标题、摘要、正文等。封面可上传插图或照片，建议横图。首页裁剪铺满卡片顶部，正文页显示完整比例。空封面保留等高线图案。
- “固定页面 → 队伍规程”：编辑规程正文；目前仍为明确标注的占位内容，尚未录入正式条文。
- Markdown 支持标题、列表、表格、链接、图片；内嵌 HTML 按文本显示。图片使用上传生成的 `/uploads/...` 或 HTTPS 地址。
- 点击发布后，Markdown 和上传文件写入 GitHub，两边自动构建。关闭“在网站显示”会隐藏文章，但文件仍在公开仓库中，不可用来保存私密内容。删除文章后构建也会移除对应网页。
- 后台 Markdown 预览是内容预览；完整网站排版以构建后的预览为准。

## 文件分工

- `admin/`：后台及字段配置，不含密钥。
- `content/posts/*.md`：文章源文件。示例地址继续使用 `training-example.html` 和 `race-example.html`。
- `content/rules/index.md`：规程源文件。
- `uploads/`：封面、正文图片和附件。
- `templates/`：首页及文章布局；首页文案在这里修改。
- `team/style.css`、`team/content.css`：队伍栏目样式。
- `scripts/build.mjs`：只写入生成目录 `_site/`，不修改指南。
- `package-lock.json`：锁定 Markdown、YAML 解析依赖。使用成熟解析器，避免自制解析器遗漏常见语法。

旧 `team/index.html`、`team/posts/`、`team/rules/index.html` 保留，不再作为新构建的文章来源。部署使用 `_site/`，它只包含对读者公开的网站文件。

参考：[Decap GitHub backend](https://decapcms.org/docs/github-backend/)。
