# 队伍主页说明

现有根目录 index.html 仍是新队员指南，已经生成的二维码入口不变。队伍主页新增在 team/。

线上路径：https://lyclycnsp.github.io/SYSU-Orienteering-Team/team/

## 本地查看

在仓库根目录运行 `python -m http.server 8765 --bind 127.0.0.1`，然后打开 http://127.0.0.1:8765/team/ 。此地址仅供本机访问。

## 页面

- team/index.html：博客首页、分类筛选。
- team/rules/index.html：规程栏目占位，未录入正式章程。
- team/posts/：两篇明确标注的示例文章。
- team/resources.html：现有 PDF 下载入口。
- team/style.css、filter.js、map.svg：独立样式、筛选和装饰地图。

以上是原静态版本的预览方式。现已加入 Markdown 构建和 Decap 配置，新版请按 [CMS 接入说明](../docs/CMS.md) 构建后预览 `_site/`。现有 HTML 保留作为旧版，新文章以 `content/` 为准。认证尚需上线后登录验证。
