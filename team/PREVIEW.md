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

当前文章为 HTML，示例文章已在页面内标注，不代表正式队伍记录。尚未配置 CMS、认证或自动文章生成；如果后续接入编辑后台，需要再确定内容文件格式、GitHub 登录方式和发布流程。没有添加无效的后台登录入口。
