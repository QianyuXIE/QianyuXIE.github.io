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

### Room 棋桌

点击棋盘或顶部“棋桌”按钮可拉近镜头。棋桌内可以点选棋子再点落点，
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
