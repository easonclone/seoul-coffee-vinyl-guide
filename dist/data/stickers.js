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
   * 背景散落的貼紙：沿列表往下平均分佈、左右交錯，塞在卡片後面，
   * 只從頁緣露出一角，因此不會蓋到任何文字。
   *
   * 這裡放的是票券、收據、菜單那類帶有具體站名、日期、金額、姓名與
   * 虛構店名（카페 영희）的貼紙。它們當背景紙片沒問題，但不要搬到上面的
   * STICKERS，否則會緊貼在真實店家旁邊，容易被誤讀成該店的資訊。
   *
   * 同樣是純裝飾：aria-hidden、pointer-events: none、lazy load，
   * 且只在 768px 以上載入與顯示。
   */
  window.SCATTER_STICKERS = [
    { src: "stickers/ticket-subway.webp", width: 132, tilt: -5 },
    { src: "stickers/receipt-cafe.webp", width: 96, tilt: 4 },
    { src: "stickers/tag-number.webp", width: 92, tilt: -7 },
    { src: "stickers/cup-takeaway.webp", width: 84, tilt: 6 },
    { src: "stickers/ticket-ktx.webp", width: 146, tilt: 3 },
    { src: "stickers/card-stamp.webp", width: 124, tilt: -4 },
    { src: "stickers/note-course.webp", width: 150, tilt: 5 },
    { src: "stickers/cake.webp", width: 118, tilt: -3 },
    { src: "stickers/pass-boarding.webp", width: 156, tilt: 4 },
    { src: "stickers/menu-cafe.webp", width: 92, tilt: -6 },
    { src: "stickers/ticket-bus.webp", width: 112, tilt: 5 },
    { src: "stickers/bag-coffee.webp", width: 104, tilt: -4 },
    { src: "stickers/ticket-exhibition.webp", width: 142, tilt: 3 },
    { src: "stickers/cup-latte.webp", width: 98, tilt: -5 },
    { src: "stickers/tag-baggage.webp", width: 86, tilt: 6 },
    { src: "stickers/note-coffee.webp", width: 126, tilt: -3 }
  ];

  /**
   * 密度：每幾個章節放一張邊欄貼紙。
   * 1 = 每章都放、2 = 每兩章、0 = 關閉。
   * 背景散落貼紙的數量則直接由 SCATTER_STICKERS 的長度決定。
   */
  window.STICKER_EVERY = 2;
})();
