(function () {
  "use strict";

  /**
   * 散落在章節邊欄的裝飾貼紙。
   *
   * 空陣列時完全不 render，不會有任何多餘節點。
   * 圖檔請放在 dist/stickers/ 底下，用相對路徑引用
   *（CSP 的 img-src 只允許 'self' 與 data:）。
   *
   * 每張貼紙：
   *   src    相對於 dist/ 的路徑，必須是去背的 PNG / WebP，單張貼紙而不是整張貼紙表
   *   width  顯示寬度（px），建議 90–150；高度自動
   *   tilt   旋轉角度，建議 -8 ~ 8
   *
   * 貼紙是純裝飾：aria-hidden、pointer-events: none、lazy load，
   * 並且只在 768px 以上的邊欄出現，手機版不顯示以免干擾閱讀。
   */
  window.STICKERS = [
    // { src: "stickers/ticket-subway.png", width: 132, tilt: -4 },
    // { src: "stickers/tag-icn.png", width: 96, tilt: 5 },
    // { src: "stickers/label-seoul.png", width: 116, tilt: -3 },
    // { src: "stickers/coffee-cup.png", width: 88, tilt: 6 },
    // { src: "stickers/stamp-card.png", width: 124, tilt: -5 }
  ];

  /**
   * 密度：每幾個章節放一張貼紙。
   * 1 = 每章都放、2 = 每兩章、0 = 關閉。
   */
  window.STICKER_EVERY = 2;
})();
