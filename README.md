# Qianyu Xie — Personal Website

这是谢浅羽的个人网站源码，部署在 [qianyuxie.github.io](https://qianyuxie.github.io/)。网站使用 Jekyll 构建，并由 GitHub Pages 自动发布。

## 页面

- `/`：学术简历与个人介绍
- `/room/`：使用 Three.js 展示的互动 3D 房间
- `/moment/`：文章与生活记录
- `/about/`：摄影与个人页面

主页、Moment、About 和文章页沿用原有的 Jekyll/Hux 页面结构。Room 使用独立布局和作用域样式，因此房间的视觉与交互不会修改其他页面。

## 目录结构

```text
├─ _includes/              Jekyll 页面组件
├─ _layouts/               页面布局
├─ _posts/                 文章
├─ assets/css/             CV 与 Room 的页面样式
├─ assets/room3d/          浏览器加载的模型、贴图和脚本
├─ img/                    照片及网站图片
├─ js/                     页面交互脚本
├─ room-3d/                Blender 建模源码、Three.js 源码与检查脚本
├─ index.md                CV 主页
├─ room.html               Room 内容配置
├─ moment.html             Moment 页面
└─ _config.yml             Jekyll 网站配置
```

## 本地预览

网站构建环境与 GitHub Pages 对齐，使用 Ruby、Bundler 和 Jekyll：

```bash
bundle install
bundle exec jekyll serve
```

打开 `http://127.0.0.1:4000/` 查看网站。

Room 的 Three.js 源码位于 `room-3d/web/`。修改运行时代码后，需要重新生成浏览器资源：

```bash
cd room-3d/web
npm install
npm run build
```

生成结果会写入 `assets/room3d/app/`。3D 模型源文件是 `room-3d/source/qianyu-room.blend`；只有修改模型时才需要安装 Blender。详细的模型重建说明见 `room-3d/REBUILD_GUIDE.md`。

## 更新内容

### Moment 朋友圈

每条动态是 `_moments/` 里的一个 `.md` 文件，例如 `_moments/2026-09-21-life.md`：

```markdown
---
date: 2026-09-21 18:30:00 +0800
images:
  - /img/moments/2026-09-21/01.jpg
  - /img/moments/2026-09-21/02.jpg
---

这里写朋友圈文字。可以分段，也可以使用 **粗体**。
```

使用步骤：

1. 把照片放到仓库中，例如 `img/moments/2026-09-21/`（自行新建文件夹）。
2. 在 `_moments/` 新建 Markdown 文件，填写日期、图片地址和正文。
3. 提交并推送，GitHub Pages 构建后会显示在 `/moment/`；新日期排在前面。

`date` 决定排序，建议始终写上 `+0800`。图片地址注意大小写，支持网站内 `/img/...` 路径和完整 `https://...` 地址。外链图片需允许公开访问；更推荐把照片保存在本站。图片建议先压缩，长边约 1600–2000px，避免直接上传数十 MB 的原图。

可选字段：`title: 标题`、`location: 地点`、`published: false`（暂不发布）。纯文字动态可以省略 `images`。每条最多展示 9 张图；1 张大图，2–4 张双列，5–9 张三列。点击照片查看原图，可左右切换、触屏横滑或按方向键，Escape 关闭。没有 JavaScript 时仍可点击打开图片。

如需独立缩略图或照片说明，也可以把一条图片地址写成：

```yaml
images:
  - src: /img/moments/2026-09-21/01.jpg
    thumb: /img/moments/2026-09-21/01-small.jpg
    alt: 照片的简短说明
```

`_moments/2026-09-21-example.md` 是使用现有照片的排版示例，不是真实的新动态。开始使用后可替换或删除它，并移除 `example: true`。原有 `_posts/` 文章仍保留在 Moment 下方，不需要迁移。

### Room 棋桌

点击棋盘可拉近镜头。棋桌内可以点选棋子再点落点，
也可以直接拖动；绿色标记表示合法落点。白黑双方由访问者轮流操作。
支持悔棋、重置、王车易位、吃过路兵和选择升变棋子。

点击摊开的书进入开局笔记。用左右箭头翻页，再按“把这个开局摆到棋盘”
应用局面；也可以从起始局面逐步播放棋谱。再次点击实体书会翻到下一页。
开局数据和原创笔记在 `room-3d/web/src/chess-study.js` 中维护。
平面棋盘支持方向键和 Enter；按 Escape 或关闭按钮退出棋桌。

桌面大屏可选择轻微景深。移动端默认使用直接渲染；静止时停止请求画面，
拖动视角时跳过景深处理。棋规由随浏览器资源一起打包的 `chess.js` 提供。

### 日常内容

- 在 `index.md` 和 `_includes/academic-cv-content.html` 中维护 CV 内容。
- 在 `room.html` 的 front matter 中维护房间里的歌单、书单、电影和照片。
- 在 `_posts/` 中新增 Markdown 文件发布文章。
- 在 `_config.yml` 中维护站点标题、邮箱和社交账号。

## 发布

提交并推送到 `main` 分支后，GitHub Pages 会自动构建和部署：

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

如果构建失败，可在仓库的 **Actions → pages build and deployment** 中查看 Jekyll 错误。
