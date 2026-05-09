# Short Video vs Long Video Attention Dashboard

一个可以发布到 GitHub Pages 的静态互动网页，用公开信息对比短视频与长视频平台的观看入口、时长层级、创作者供给和每日新增内容。

## 本地预览

直接打开 `index.html` 也可以浏览。为了让 `fetch("./data/metrics.json")` 在所有浏览器里稳定工作，建议用本地静态服务器：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 发布到 GitHub Pages

1. 将本目录推送到 GitHub 仓库。
2. 在仓库 Settings -> Pages 中选择 GitHub Actions。
3. 工作流 `.github/workflows/refresh-data.yml` 会每天运行一次，尝试从公开来源抓取可稳定识别的最新数字，刷新 `data/metrics.json` 并重新部署 Pages。抓取失败时会保留上一次数据。

## 数据口径

平台不会统一公开“去重全球观看人数”“按 TikTok 秒数分组的观看人数”“每日新增多少条某时长视频”。因此页面把数据分为三类：

- 官方披露：公司财报、投资者关系、官方博客。
- 可信第三方：DataReportal、QuestMobile、Reuters/CNBC/TechCrunch 等媒体转述的公开披露。
- 模型估算：创作者数量、上传量和 TikTok 秒数层级中缺乏官方披露的部分。

页面中所有估算都会标注 confidence 或 modeled。
