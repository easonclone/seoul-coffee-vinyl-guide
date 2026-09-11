# Seoul Coffee & Vinyl Guide

「首爾咖啡與黑膠店收藏」是一個輕量、手機優先的資料驅動靜態網站。第一版收錄首爾與濟州的咖啡店、烘焙空間與黑膠聆聽場所，不需要後端、資料庫、API 金鑰或建置流程。

## 檔案結構

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml      # GitHub Pages 自動部署流程
├── dist/                  # 可直接部署的網站根目錄
│   ├── index.html         # 語意化頁面結構與 SEO metadata
│   ├── styles.css         # 響應式視覺樣式
│   ├── app.js             # 搜尋、篩選、排序、URL 狀態與畫面產生
│   └── data/
│       └── places.js      # 唯一的店家資料來源
└── README.md
```

## 如何新增店家

只需編輯 `dist/data/places.js`，在 `window.PLACES` 陣列中加入一個物件，不需要修改 HTML 或 `app.js`。請確保 `id` 與 `areaSlug` 使用穩定、唯一、適合網址的英文小寫值。

```js
{
  id: "example-place",
  name: "Example Place",
  koreanName: "예시 장소",
  category: "Coffee",
  area: "區域中文名 Area",
  areaSlug: "area",
  district: "行政區 District-gu",
  address: "已確認的地址",
  naverMapUrl: "https://map.naver.com/p/search/...",
  openingHours: null,
  notes: null,
  tags: ["coffee", "area"],
  brand: null,
  city: "Seoul",
  country: "South Korea",
  active: true,
  latitude: null,
  longitude: null
}
```

沒有資料的選填欄位請設為 `null` 或省略。介面會自動隱藏空欄位，不會顯示假的 placeholder。

## Place schema

必要／核心欄位：

- `id`：穩定且唯一的識別值
- `name`、`koreanName`：英文與韓文名稱
- `category`：可讀的類別文字
- `area`、`areaSlug`、`district`：分組、網址狀態與行政區資訊
- `address`、`naverMapUrl`：地址與外部地圖連結
- `openingHours`、`notes`：可為 `null` 的補充資訊
- `tags`：搜尋與複合篩選使用的字串陣列
- `brand`、`city`、`country`、`active`：品牌、地點與啟用狀態

已預留 `latitude`、`longitude`。未來可以安全增加 `googleMapUrl`、`instagramUrl`、`websiteUrl`、`priceLevel`、`rating`、`priority`、`visited`、`favorite`、`recommendedDuration`、`nearestStation`、`image`、`lastVerifiedAt` 等選填欄位。

## 本機預覽

網站不需建置。可直接開啟 `dist/index.html`，或在專案目錄啟動任何靜態檔案伺服器：

```bash
python3 -m http.server 8000 --directory dist
```

接著開啟 `http://localhost:8000`。

## 部署

所有平台的發佈目錄皆為 `dist`，不需要 build command。

### Vercel

- Framework Preset：Other
- Build Command：留空
- Output Directory：`dist`

### Netlify

- Build Command：留空
- Publish directory：`dist`

### Cloudflare Pages

- Framework preset：None
- Build command：留空
- Build output directory：`dist`

### GitHub Pages

專案已包含 `.github/workflows/pages.yml`。推送到 GitHub 後：

1. 進入儲存庫的 `Settings` → `Pages`。
2. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
3. 推送至 `main`，或在 `Actions` 頁面手動執行部署流程。
4. 部署完成後，網址會顯示在該次工作流程的 `deploy` 作業中。

工作流程會直接上傳 `dist`，不會執行額外建置。所有網站資源皆採相對路徑，因此相容於 `https://使用者名稱.github.io/儲存庫名稱/` 形式的專案網站。

## URL 狀態

搜尋、標籤、城市、區域與排序狀態會寫入 query parameters，重新整理後仍會保留。支援例如：

- `?q=fritz`
- `?tag=vinyl`
- `?tag=coffee&city=seoul`
- `?area=yeonhui`
- `?sort=name`

## 未來擴充

- 加入座標後切換 NAVER Maps、Mapbox 或 Google Maps 地圖模式
- 以 `localStorage` 儲存 Want to go、Visited、Favorite，之後替換為登入與資料庫
- 依區域、優先度、距離與營業時間產生半日／一日行程
- 增加搜尋索引、進階標籤、API 或簡易管理介面
- 將目前的純資料模組改接 API，而不需要重寫卡片與篩選介面
- 串接 ChatGPT / OpenAI，提供自然語言找店與行程建議

## 資料維護原則

不猜測地址、營業時間、座標、營業狀態或 NAVER place ID。新增或更新資料前應由可信來源查證；網站頁尾也提醒訪客出發前再次確認。
