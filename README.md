# Seoul Coffee & Vinyl Guide

「首爾咖啡與黑膠店收藏」是一個輕量、手機優先的資料驅動靜態網站。目前收錄首爾的咖啡店、烘焙空間、黑膠聆聽場所、餐廳、服飾店與景點，不需要後端、資料庫、API 金鑰或建置流程。

## 檔案結構

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml      # GitHub Pages 自動部署流程
├── dist/                  # 可直接部署的網站根目錄
│   ├── index.html         # 語意化頁面結構、CSP 與 SEO metadata
│   ├── styles.css         # 響應式視覺樣式與字體設定
│   ├── app.js             # 搜尋、篩選、排序、URL 狀態與畫面產生
│   └── data/
│       ├── areas.js       # 區域定義：顯示名稱、cluster、座標、地圖投影範圍
│       └── places.js      # 唯一的店家資料來源
└── README.md
```

## 如何新增店家

只需編輯 `dist/data/places.js`，在 `window.PLACES` 陣列中加入一個物件，不需要修改 HTML 或 `app.js`。請確保 `id` 與 `areaSlug` 使用穩定、唯一、適合網址的英文小寫值。

分類篩選、次分類篩選、地圖節點與區域索引全部由資料 derive，新增分類或次分類不需要改動 UI。若新增的 `areaSlug` 尚未出現在 `dist/data/areas.js`，該區域仍會正常分組與顯示，只是不會出現在地圖上；要讓它上地圖，請在 `window.AREAS` 補一筆定義。

```js
{
  id: "example-place",
  name: "Example Place",
  koreanName: "예시 장소",
  category: "Coffee",
  subcategory: "Roastery",
  area: "區域中文名 Area",
  areaSlug: "area",
  district: "行政區 District-gu",
  address: "已確認的地址",
  naverMapUrl: "https://map.naver.com/p/search/...",
  openingHours: null,
  notes: null,
  source: null,
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
- `category`：單一 top-level 分類（`Coffee`／`Vinyl`／`Restaurant`／`Attraction`…），篩選選項由此 derive
- `subcategory`：選填細分類，多個值以 `" / "` 分隔（例如 `"Korean / Seafood"`），UI 會自動拆成第二層篩選
- `area`、`areaSlug`、`district`：分組、網址狀態與行政區資訊；`areaSlug` 對應 `data/areas.js`
- `address`、`naverMapUrl`：地址與外部地圖連結
- `openingHours`、`notes`、`source`：可為 `null` 的客觀補充（`source` 用於節目、推薦人等出處），
  一律使用排版體呈現
- `tags`：搜尋與複合篩選使用的字串陣列
- `brand`、`city`、`country`、`active`：品牌、地點與啟用狀態
- `visited`、`favorite`、`recommended`：選填布林值，設為 `true` 才會在卡片上蓋章；
  未設定就不蓋。其餘印章由 tags 推導（`recommended`／`chef` → RECOMMENDED、
  `tv` → ON TV、`queue` → EXPECT A QUEUE），一張卡最多兩枚

### 選填的旅行記錄

以下欄位全部可省略，沒有資料時對應的區塊完全不會 render：

| 欄位 | 型別 | 呈現方式 |
| --- | --- | --- |
| `personalNote` | string | 標成 **MY NOTE**，是全站唯一使用手寫視覺語言的卡片區塊 |
| `visitedAt` | `"2025-04-12"` | 卡片上顯示 `VISITED 2025-04-12`，並蓋 VISITED 章 |
| `plannedAt` | `"2025-04-14"` | 顯示 `PLANNED …`，並蓋 PLANNED 章（已有 visitedAt 時不重複） |
| `tripDay` | number | 顯示 `DAY 2` |
| `favorite` / `recommended` | boolean | 蓋對應的章 |
| `photo` | object | 見下方「照片插頁」 |

`notes` 與 `personalNote` 是**刻意分開**的：前者是客觀補充（走排版體、放在
Address／Hours 同一組 FACTS 裡），後者才是自己的話。不要把主觀感想寫進 `notes`。

### 照片插頁

```js
photo: { src: "photos/protokoll.jpg", caption: "延禧洞的早晨", style: "polaroid" }
photo: { srcs: ["a.jpg", "b.jpg", "c.jpg"], caption: "Contact sheet", style: "contact" }
photo: { src: "photos/receipt.jpg", caption: "收據 · 2025-04-13", style: "ticket" }
```

`style` 為 `polaroid`（預設）／`contact`（最多 4 張的印樣條）／`ticket`（票根、收據）。
圖檔請放在 `dist/` 底下用相對路徑引用（CSP 的 `img-src` 只允許 `'self'` 與 `data:`）。
照片刻意不做滿版，是夾進筆記本的插頁而不是主視覺。

### Area schema（`dist/data/areas.js`）

- `window.CLUSTERS`：以實際旅遊動線（可步行／同一趟行程）分群，陣列順序即列表與地圖編號順序。
  選填的 `note` 會成為章節標題下的一句手寫副標，請用自己的話寫，空著就不 render
- `window.ROUTES`：選填的手繪路線圖層，空陣列就完全不畫。只放資料，SVG 由 `app.js`
  依 `AREAS` 的座標產生，兩者分離，且不串接任何 routing API

```js
window.ROUTES = [
  { day: 1, label: "DAY 01", stops: ["cheongun", "seochon", "wonseo", "jangchung"] },
  { day: 2, label: "DAY 02", tone: "ink", stops: ["mangwon", "seogyo", "yeonnam", "yeonhui"] }
];
```

`stops` 是 `areaSlug` 陣列（至少兩個），`tone` 可選 `accent`（預設）或 `ink`。
地圖上會畫出虛線路徑、段落中點的方向箭頭與 DAY 標註，並在地圖標頭顯示圖例。
- `window.AREAS`：每個 `areaSlug` 的顯示名稱、所屬 cluster 與經緯度；選填的 `nudge` 只是
  地圖上的視覺位移，用來避免節點重疊、並確保點落在漢江正確的一岸。新增區域後請重新檢查
  節點是否重疊（手機寬度最嚴苛），不要只看桌機
- `window.MAP_VIEW`：地圖投影範圍，必須與 `index.html` 底圖 SVG 的 `viewBox` 一致。
  要納入更東邊的區域時，維持 `width / (east - west)` 的比例尺不變、只加大 `east` 與
  `width`，既有的底圖路徑座標就完全不必重算
- `window.CATEGORY_ORDER`：只影響分類按鈕的排序，實際選項仍由 places 資料 derive

已預留 `latitude`、`longitude`。未來可以安全增加 `googleMapUrl`、`instagramUrl`、`websiteUrl`、`priceLevel`、`rating`、`priority`、`visited`、`favorite`、`recommendedDuration`、`nearestStation`、`image`、`lastVerifiedAt` 等選填欄位。

## 視覺語言

整體定位是「設計師的首爾旅行筆記本」，不是旅遊部落格也不是後台介面。實作方式：

- **紙張質感**：以 SVG `feTurbulence` 產生的極淡顆粒（data URI，不需外部圖檔），
  疊在頁面、地圖面板與卡片上
- **四種便條紙**：素面、便條本（撕邊 + 橫線）、方格紙、索引卡（左側紅色邊界線）。
  以 `place.id` 的雜湊決定，重繪時不會跳動
- **三種紙膠帶**：左上短條、右上斜角、中央雙條，用另一組雜湊分配
- **手寫註記**：只有 `notes`（個人備註）使用手寫體與墨藍色側線，
  其餘欄位維持排版體，避免整頁都像手寫
- **語意貼紙**：`category` 對應的低彩度色標
- **橡皮章**：雙線外框、褪色墨水、極小角度
- **筆記本章節**：每個 cluster 是一個章節 —— 左側裝訂線、貼在線上的側標編號、
  章節標題與羅馬拼音、選填的手寫副標，章節結尾用一條細線加頁碼（`— 018 —`）作結，
  不再使用粗黑分隔線
- **FACTS 與 MY NOTE 分離**：Area／Address／Hours／Notes／Source 一律排版體，
  只有 `personalNote` 會被標成 MY NOTE 並使用手寫體
- **手繪標記**：區域小標底線、結果數量的圈選、地圖說明旁的箭頭，只用在這三處
- **地圖的鉛筆／墨水筆觸**：丘陵排線、河道虛線中心線、虛線羅盤

刻意避免：高彩度粉色、卡通圖示、emoji、無意義貼紙、強烈陰影、大量旋轉、
咖啡漬、幼稚手寫字。旋轉只用在兩種紙張（約 0.3 度）與印章。
`prefers-reduced-motion` 開啟時全部不旋轉、不位移。

## 字體

顯示字體為 Google Fonts 的 Fraunces（標題）與 Inter（介面），中文標題使用
Noto Serif TC，韓文店名使用 Noto Sans KR，個人備註使用 Caveat；全部以
`display=swap` 載入，未載入完成前會退回 Georgia 與系統字體。

中文手寫體 Google Fonts 沒有合適的繁體選擇，因此備註的字體堆疊為
`Caveat` → `LXGW WenKai TC`（使用者本機有才會套用）→ `Noto Serif TC`，
中文部分靠墨藍色與側線呈現註記感，而不是硬套裝飾字體。

為此 `index.html` 的 CSP 放寬了兩個網域，其餘指令維持不變：

```
style-src 'self' https://fonts.googleapis.com;
font-src  'self' https://fonts.gstatic.com;
```

若要完全不連外，可改為自行託管字體檔並把這兩條改回 `'self'`。

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

搜尋、分類、次分類、品牌、標籤、城市、區域與排序狀態會寫入 query parameters，重新整理後仍會保留。支援例如：

- `?q=fritz`
- `?category=Restaurant`
- `?category=Restaurant&sub=chinese&sub=eel`
- `?category=Coffee&brand=fritz%20coffee%20company`
- `?area=yeonhui`
- `?sort=name`

舊版的 `?tag=` 與 `?city=` 仍然可用。

## 未來擴充

- 加入座標後切換 NAVER Maps、Mapbox 或 Google Maps 地圖模式
- 以 `localStorage` 儲存 Want to go、Visited、Favorite，之後替換為登入與資料庫
- 依區域、優先度、距離與營業時間產生半日／一日行程
- 增加搜尋索引、進階標籤、API 或簡易管理介面
- 將目前的純資料模組改接 API，而不需要重寫卡片與篩選介面
- 串接 ChatGPT / OpenAI，提供自然語言找店與行程建議

## 資料維護原則

不猜測地址、營業時間、座標、營業狀態或 NAVER place ID。新增或更新資料前應由可信來源查證；網站頁尾也提醒訪客出發前再次確認。

- 不要把即時營業狀態（`영업 중`／`곧 영업 시작`／`브레이크타임`／`영업 종료`）寫進資料，那些只是複製當下的瞬間狀態。
- 沒有可靠來源時，`openingHours`、`latitude`、`longitude`、評分、價格、電話、訂位連結一律留空。
- `naverMapUrl` 只填確切已知的連結。沒有時請留 `null`；此時卡片會改顯示「NAVER 搜尋」，以 `koreanName` + `address` 組成關鍵字搜尋網址，不會臆造 place id。
