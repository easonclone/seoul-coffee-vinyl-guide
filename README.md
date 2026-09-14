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
│   ├── app.js             # 啟動流程與事件綁定
│   ├── js/
│   │   ├── core.js        # 共用資料、狀態、搜尋與網址狀態
│   │   ├── cards.js       # 店家卡片、複製與裝飾內容
│   │   ├── controls.js    # 分類與次分類控制項
│   │   └── map.js         # 地圖節點與旅遊路線
│   ├── styles/
│   │   ├── base.css       # 色票、字體、底紙與頁首
│   │   ├── map.css        # 區域地圖與索引
│   │   ├── controls.css   # 搜尋、篩選與結果摘要
│   │   ├── sections.css   # 章節、區域與散落貼紙
│   │   ├── cards-shell.css # 卡片紙張、膠帶與外框
│   │   ├── cards-content.css # 卡片文字、標籤與照片
│   │   ├── interactions.css # 路線、操作、提示與分享定位
│   │   ├── utility.css    # 空狀態與頁尾
│   │   └── responsive.css # 桌機、平板與手機版面
│   ├── stickers/          # 裝飾貼紙圖檔（選用，預設不存在）
│   └── data/
│       ├── areas.js       # 區域定義：顯示名稱、cluster、座標、地圖投影範圍
│       ├── stickers.js    # 裝飾貼紙清單與密度（預設空陣列）
│       └── places.js      # 唯一的店家資料來源
└── README.md
```

## 前端模組與載入順序

網站維持可直接部署的原生 HTML、CSS 與 JavaScript，不需要套件管理器或建置工具。JavaScript
透過 `window.SeoulGuide` 共用必要狀態，並由 `index.html` 依下列順序載入：

1. `data/*.js`：純資料
2. `js/core.js`：共用狀態與工具
3. `js/cards.js`、`js/controls.js`、`js/map.js`：各自的畫面功能
4. `app.js`：組合功能、綁定事件並啟動網站

這些檔案使用傳統 `defer` script，因此調整檔名或順序時，必須同步更新 `dist/index.html`。
樣式檔也依 `base`、元件、互動、響應式覆寫的順序載入，請避免任意調換，以免改變 CSS cascade。

修改前端後可執行 `node scripts/check-frontend.mjs`，檢查本機資源、腳本順序與啟動流程。

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
- `category`：單一 top-level 分類（`Coffee`／`Bakery`／`Vinyl`／`Restaurant`／`Lifestyle`…），篩選選項由此 derive
- `subcategory`：選填細分類，多個值以 `" / "` 分隔（例如 `"Korean / Seafood"`），UI 會自動拆成第二層篩選
- `area`、`areaSlug`、`district`：分組、網址狀態與行政區資訊；`areaSlug` 對應 `data/areas.js`
- `address`、`naverMapUrl`：地址與外部地圖連結
- `instagramUrl`、`websiteUrl`：選填的 Instagram 與官方網站，會顯示為卡片底部小型動作
- `openingHours`、`source`：可為 `null` 的客觀補充（`source` 用於節目、推薦人等出處），
  與 Area／Address 同屬 FACTS，一律排版體、不上螢光筆
- `rating`：選填的一至五星推薦程度；`priority: "benchmark"` 則顯示為「基準」
- `notes`：旅行中隨手記下的一句，會進 MY NOTE 區塊並標上螢光筆
- `tags`：搜尋與複合篩選使用的字串陣列
- `brand`、`city`、`country`、`active`：品牌、地點與啟用狀態
- `visited`、`favorite`、`recommended`：選填布林值，設為 `true` 才會在卡片上蓋章；
  未設定就不蓋。其餘印章由 tags 推導（`recommended`／`chef` → RECOMMENDED、
  `tv` → ON TV、`queue` → EXPECT A QUEUE），一張卡最多兩枚

### 選填的旅行記錄

以下欄位全部可省略，沒有資料時對應的區塊完全不會 render：

| 欄位 | 型別 | 呈現方式 |
| --- | --- | --- |
| `personalNote` | string | 更私人的一句。與 `notes` 並存時由它取得螢光筆，`notes` 降為未標記的補充 |
| `noteColor` | `yellow` \| `green` \| `pink` \| `blue` | 螢光筆顏色，省略時依 tags 推導 |
| `noteStyle` | `marker` \| `underline` \| `plain` | 筆觸樣式，省略時自動判斷 |
| `visitedAt` | `"2025-04-12"` | 卡片上顯示 `VISITED 2025-04-12`，並蓋 VISITED 章 |
| `plannedAt` | `"2025-04-14"` | 顯示 `PLANNED …`，並蓋 PLANNED 章（已有 visitedAt 時不重複） |
| `tripDay` | number | 顯示 `DAY 2` |
| `favorite` / `recommended` | boolean | 蓋對應的章 |
| `photo` | object | 見下方「照片插頁」 |

### MY NOTE 與螢光筆

卡片分成兩層：**FACTS**（Area／Address／Hours／Source）維持乾淨的 editorial typography，
完全不上色；**MY NOTE** 才是旅行中補寫的個人註記，使用手寫體並加上螢光筆筆觸。

- 每張卡**最多一段**被標記的文字，不會整張卡花掉
- 沒有 `notes` 也沒有 `personalNote` 時，整個區塊不 render，不留 placeholder
- 顏色語意：`yellow` 推薦／必試、`green` 順路再說、`pink` 個人偏好、`blue` 時間與排隊提醒
- `noteColor` 未指定時的推導順序：`favorite` → pink、tag `queue` → blue、
  tag `nature`／`attraction` → green、其餘 → yellow（保守預設）
- 超過 24 字的長句自動改用底線式筆觸而非整段塗滿，可用 `noteStyle` 覆寫
- 四色為淡螢光筆色（yellow `#f3e05a`／green `#a9df7c`／pink `#f4a6c0`／blue `#93d4ef`），
  以約 0.58 的不透明度疊在紙上，維持「淡」但看得出是螢光筆
- 筆觸是以 SVG data URI 畫的半透明不規則色塊（邊緣有起伏、有兩道疊筆模擬重複劃過），
  紙張顆粒會透出來；沒有引入任何函式庫

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
- `window.ROUTES`：選填的手繪路線圖層，空陣列就完全不畫。只放資料，SVG 由 `js/map.js`
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

已預留 `latitude`、`longitude`。未來可以安全增加 `googleMapUrl`、`priceLevel`、`priority`、`visited`、`favorite`、`recommendedDuration`、`nearestStation`、`image`、`lastVerifiedAt` 等選填欄位。

## 視覺語言

整體定位是「年輕人的旅行拼貼筆記本」——明亮、輕盈、有拼貼感，但資訊仍然乾淨可讀。
裝飾一律從屬於內容。

**底紙**：暖白基底加上淡藍格線（細格 26px、粗格 130px）與極輕的紙張顆粒，
不做舊、不泛黃。手機上細格線太密會干擾閱讀，因此只保留放大到 88px 的單層格線。標頭後面壓一塊紅色格紋紙片與一小段紙膠帶，地圖面板上緣也有兩段膠帶，
整頁的拼貼元素刻意控制在少數幾處。

**色票**：`--paper` 暖白、`--ink` 深藍灰、`--accent` 番茄紅，
外加 `--blush`／`--coral`／`--butter`／`--mint`／`--sky`／`--lilac` 供貼紙、
分頁標籤、紙膠帶、螢光筆使用。彩色只出現在標記與互動處，大面積仍是淺色留白。

**六種紙片**（由 `place.id` 的雜湊決定，重繪不會跳動）：

| variant | 樣子 |
| --- | --- |
| 0 | 素面 memo |
| 1 | 便條本：撕下來的上緣 + 橫線 |
| 2 | 方格紙 + 兩個相片角 |
| 3 | 索引卡：左側紅色邊界線 |
| 4 | 收據：上下撕票鋸齒、虛線折痕、等寬字編號，不貼膠帶 |
| 5 | 貼紙底：後面墊一張彩色紙，顏色依 `category` 走 |

另有三種紙膠帶（另一組雜湊分配）、右下角摺角，以及極小的旋轉與上緣落差
（約 0.25–0.45 度）製造一片片貼上去的不對稱感。

**小塗鴉**：星星、愛心、咖啡杯、閃光、花、唱片、貓，全部是 SVG data URI，
可重用也方便控制密度。目前只用在章節標題旁（一章一個，依章節循環）與區域小標旁。

**裝飾貼紙**：`dist/stickers/` 收了 27 張從貼紙表切出來的單張去背 WebP（共約 380 KB，
單張 8–20 KB），由 `dist/data/stickers.js` 決定要用哪幾張、多大、傾斜幾度。
貼紙散落在章節左欄，依章節序號輪流取用，位置固定不會亂跳。

```js
window.STICKERS = [
  { src: "stickers/label-seoul.webp", width: 118, tilt: -4 },
  { src: "stickers/icon-star.webp", width: 62, tilt: 6 }
];
window.STICKER_EVERY = 2;   // 每幾章放一張；1 = 每章、0 = 關閉
```

密度只靠 `STICKER_EVERY` 一個數字控制。貼紙一律 `aria-hidden`、`pointer-events: none`，
**只在 768px 以上出現，而且手機上根本不會下載**——`src` 等版面夠寬才補上，
手機端對 `stickers/` 的請求數是 0。陣列留空則完全不 render。

貼紙分成兩層，27 張全部有用到：

- `window.STICKERS`（11 張）放在**章節左欄**，緊鄰章節標題，所以只收沒有具體
  虛構資訊的那幾張：서울／연남 標籤、星星、愛心、箭頭、定位針、行李吊牌、
  格紋膠帶、咖啡豆、冰美式、여행하자。
- `window.SCATTER_STICKERS`（16 張）是**背景散落層**，沿列表往下平均分佈、
  一律靠右，塞在卡片後面只露出一角。車票、登機證、收據、菜單、集點卡那幾張
  帶有站名、日期、金額、姓名與虛構店名（카페 영희）的就放這裡——當背景紙片
  沒問題，但不要搬到 `STICKERS`，否則會緊貼在真實店家旁邊被誤讀成該店資訊。

散落層一律靠右是刻意的：右側是不透明的卡片欄，貼紙只會從卡片邊緣露出來；
左欄有章節標題文字，放了會擋住字。

**章節**：左側裝訂線 + 彩色分頁標籤（顏色依章節循環）+ 標題 + 羅馬拼音 +
由該群分類推導出來的一行小標（如 `coffee + vinyl`）+ 選填的手寫副標，
結尾用細線加頁碼作結。

**地圖**：淡格紙底、淺藍河道、薄荷綠丘陵，滑過索引時對應節點會被手繪圈起來，
不做成正式的 GIS 視覺。

**卡片動作**：NAVER Map 維持唯一的主要按鈕（深色橫條），底下再放一排純文字的
次要動作 `이름 복사 · 주소 복사 · 링크 복사`，用細底線而不是按鈕框，避免變成工具列。
手機上每個動作的點擊高度約 46px。刻意不使用 Web Share API：桌面版 Chrome 呼叫
`navigator.share()` 會直接終止分頁（RESULT_CODE_KILLED_BAD_MESSAGE），改為單純
複製連結。複製的回饋是一張貼著紙膠帶的小便條
（`#toast`，本身即 `role="status"` + `aria-live="polite"`），約 1.8 秒後消失，
不是黑色 snackbar。

**資訊層級**：店名、韓文名、category、area、address、NAVER Map 一律維持清楚的
editorial typography；notes、tags、source 與所有裝飾元素都排在後面。
手寫體與螢光筆只用於 MY NOTE，不會擴散到主要資訊。

刻意避免：大面積深色、做舊泛黃、高飽和彩虹、大型插畫、每個區塊都貼滿東西、
強烈陰影與大角度旋轉。`prefers-reduced-motion` 開啟時所有旋轉與位移停用。

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

### `?place=` 單一店家連結

每張卡片的「링크 복사」會複製 `?place=<place.id>` 的永久連結，並**保留當下的篩選條件**：

```
?category=Restaurant&area=nonhyeon&place=daegabang-main
```

以這種網址進站時會捲到對應卡片並短暫標記（螢光筆外框 + 角落小標籤 + 聚焦），
約 6 秒後標記消失，但網址不變、重新整理仍有效。找不到該 id 時安靜略過，
不報錯也不改動篩選。

`place` 只有在使用者**明確離開單一店家情境**時才會從網址移除：輸入搜尋、
清除搜尋、切換分類／次分類／品牌、變更排序、按「顯示全部店家」。
其餘重繪都不會動到它。

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
