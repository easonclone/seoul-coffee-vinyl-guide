(function () {
  "use strict";

  /**
   * 地圖投影範圍。與 index.html 中底圖 SVG 的 viewBox 必須一致。
   * 節點位置由 latitude / longitude 線性投影而來，不寫死在 CSS。
   */
  window.MAP_VIEW = {
    west: 126.83,
    east: 127.085,
    north: 37.605,
    south: 37.468,
    width: 1000,
    height: 676
  };

  /**
   * 分類的顯示順序。實際可選分類仍由 places 資料 derive，
   * 這裡只決定排序；沒列到的分類會排在後面。
   */
  window.CATEGORY_ORDER = ["Coffee", "Vinyl", "Restaurant", "Attraction"];

  /**
   * 以實際旅遊動線（可步行 / 同一趟行程）分群，而不是行政區。
   * 陣列順序即為列表與地圖編號順序。
   */
  window.CLUSTERS = [
    { slug: "seochon", name: "西村・景福宮・仁王山", roman: "Seochon · Inwangsan" },
    { slug: "wonseo", name: "苑西洞・昌德宮", roman: "Wonseo · Changdeokgung" },
    { slug: "junggu", name: "中區・會賢洞", roman: "Jung-gu · Hoehyeon" },
    { slug: "jangchung", name: "獎忠洞・東大入口", roman: "Jangchung" },
    { slug: "hongdae", name: "延禧・延南・望遠・弘大", roman: "Yeonnam · Hongdae" },
    { slug: "gongdeok", name: "孔德・桃花洞", roman: "Gongdeok · Dohwa" },
    { slug: "yongsan", name: "龍山", roman: "Yongsan" },
    { slug: "yeouido", name: "汝矣島", roman: "Yeouido" },
    { slug: "gangnam", name: "江南・論峴・新沙・驛三・大峙", roman: "Gangnam · Sinsa · Daechi" },
    { slug: "seocho", name: "瑞草・方背・瑞來村", roman: "Seocho · Seorae" },
    { slug: "yangjae", name: "良才", roman: "Yangjae" }
  ];

  /**
   * 每個 areaSlug 的顯示名稱、所屬 cluster 與座標。
   * nudge 為地圖上的視覺位移（viewBox 單位），只用來避免節點互相重疊，
   * 不影響資料本身；底圖河道為示意繪製，故少數點需要微調對位。
   */
  window.AREAS = [
    { slug: "seochon", name: "西村・景福宮", roman: "Seochon", cluster: "seochon", lat: 37.579, lng: 126.97 },
    { slug: "cheongun", name: "清雲洞・仁王山", roman: "Cheongun", cluster: "seochon", lat: 37.5872, lng: 126.966, nudge: { x: -18, y: -10 } },
    { slug: "dongnimmun", name: "獨立門", roman: "Dongnimmun", cluster: "seochon", lat: 37.573, lng: 126.9585 },
    { slug: "wonseo", name: "苑西洞・昌德宮", roman: "Wonseo", cluster: "wonseo", lat: 37.58, lng: 126.9865 },
    { slug: "hoehyeon", name: "會賢洞", roman: "Hoehyeon", cluster: "junggu", lat: 37.558, lng: 126.98 },
    { slug: "jangchung", name: "獎忠洞・東大入口", roman: "Jangchung", cluster: "jangchung", lat: 37.558, lng: 127.006 },
    { slug: "yeonhui", name: "延禧洞", roman: "Yeonhui", cluster: "hongdae", lat: 37.568, lng: 126.93, nudge: { x: 8, y: -12 } },
    { slug: "yeonnam", name: "延南洞", roman: "Yeonnam", cluster: "hongdae", lat: 37.5615, lng: 126.9235, nudge: { x: -8, y: 12 } },
    { slug: "seogyo", name: "西橋洞・弘大", roman: "Seogyo", cluster: "hongdae", lat: 37.553, lng: 126.921, nudge: { x: -14, y: 12 } },
    { slug: "mangwon", name: "望遠洞", roman: "Mangwon", cluster: "hongdae", lat: 37.556, lng: 126.9025 },
    { slug: "gongdeok", name: "孔德・桃花洞", roman: "Gongdeok", cluster: "gongdeok", lat: 37.544, lng: 126.951 },
    { slug: "yongsan", name: "龍山", roman: "Yongsan", cluster: "yongsan", lat: 37.53, lng: 126.965 },
    { slug: "yeouido", name: "汝矣島", roman: "Yeouido", cluster: "yeouido", lat: 37.5219, lng: 126.9245, nudge: { x: 3, y: -42 } },
    { slug: "sinsa", name: "新沙洞", roman: "Sinsa", cluster: "gangnam", lat: 37.5209, lng: 127.0227, nudge: { x: 6, y: -12 } },
    { slug: "nonhyeon", name: "論峴洞", roman: "Nonhyeon", cluster: "gangnam", lat: 37.5109, lng: 127.0219 },
    { slug: "yeoksam", name: "驛三洞", roman: "Yeoksam", cluster: "gangnam", lat: 37.5008, lng: 127.0365 },
    { slug: "daechi", name: "大峙洞", roman: "Daechi", cluster: "gangnam", lat: 37.4942, lng: 127.0635 },
    { slug: "seorae", name: "盤浦洞・瑞來村", roman: "Seorae Village", cluster: "seocho", lat: 37.4986, lng: 126.9957 },
    { slug: "bangbae", name: "方背洞", roman: "Bangbae", cluster: "seocho", lat: 37.4813, lng: 126.9956 },
    { slug: "yangjae", name: "良才", roman: "Yangjae", cluster: "yangjae", lat: 37.484, lng: 127.034 }
  ];
})();
