(function () {
  "use strict";

  /**
   * 散落在章節左欄的裝飾貼紙。
   *
   * 圖檔在 dist/stickers/，都是從貼紙表切出來的單張去背 WebP
   *（CSP 的 img-src 只允許 'self' 與 data:，所以必須放在站內）。
   *
   * 每張貼紙：
   *   src    相對於 dist/ 的路徑
   *   width  顯示寬度（px），建議 50–150；高度自動
   *   tilt   旋轉角度，建議 -8 ~ 8
   *
   * 貼紙是純裝飾：aria-hidden、pointer-events: none、lazy load，
   * 並且只在 768px 以上出現，手機版不顯示以免干擾閱讀。
   * 陣列留空就完全不 render，也不會發出任何圖片請求。
   */
  window.STICKERS = [
    { src: "stickers/label-seoul.webp", width: 118, tilt: -4 },
    { src: "stickers/icon-star.webp", width: 62, tilt: 6 },
    { src: "stickers/tag-icn.webp", width: 84, tilt: -6 },
    { src: "stickers/tape-gingham.webp", width: 130, tilt: 3 },
    { src: "stickers/icon-hearts.webp", width: 52, tilt: -3 },
    { src: "stickers/beans.webp", width: 96, tilt: 5 },
    { src: "stickers/label-yeonnam.webp", width: 140, tilt: -2 },
    { src: "stickers/icon-arrow.webp", width: 74, tilt: 4 },
    { src: "stickers/cup-iced.webp", width: 78, tilt: -5 },
    { src: "stickers/icon-pin.webp", width: 48, tilt: 3 },
    { src: "stickers/label-travel.webp", width: 86, tilt: -6 }
  ];

  /**
   * 以下這些貼紙上面有具體的站名、日期、金額、姓名或店名（카페 영희），
   * 貼在真實店家旁邊可能被誤讀成該店的資訊，所以預設不啟用。
   * 想用的話搬到上面的陣列即可，檔案都已經在 dist/stickers/。
   *
   *   stickers/ticket-subway.webp       지하철 승차권（서울역 ▶ 연남동、1,400원）
   *   stickers/ticket-bus.webp          시내버스 승차권（1,500원）
   *   stickers/ticket-ktx.webp          KTX 승차권（서울 ▶ 부산、座位號）
   *   stickers/ticket-exhibition.webp   전시회 입장권（展期、12,000원）
   *   stickers/pass-boarding.webp       탑승권（含姓名 KIM / JIYEON、航班）
   *   stickers/tag-baggage.webp         BAGGAGE CLAIM STUB（行李條碼）
   *   stickers/tag-number.webp          번호표 057
   *   stickers/note-course.webp         오늘의 코스（서울역→성수→연남동→한강）
   *   stickers/receipt-cafe.webp        카페 영희 영수증（品項與金額）
   *   stickers/menu-cafe.webp           CAFE MENU（價目表）
   *   stickers/card-stamp.webp          카페 영희 集點卡
   *   stickers/bag-coffee.webp          카페 영희 咖啡豆袋
   *   stickers/note-coffee.webp         便條（좋은 커피는 필수!）
   *   stickers/cup-takeaway.webp        카페 영희 外帶杯
   *   stickers/cup-latte.webp           拿鐵杯
   *   stickers/cake.webp                起司蛋糕
   */

  /**
   * 密度：每幾個章節放一張貼紙。
   * 1 = 每章都放、2 = 每兩章、0 = 關閉。
   */
  window.STICKER_EVERY = 2;
})();
