window.SeoulGuide = window.SeoulGuide || {};

(function (app) {
  "use strict";

  const places = Array.isArray(window.PLACES) ? window.PLACES.filter((place) => place.active !== false) : [];
  const areas = Array.isArray(window.AREAS) ? window.AREAS : [];
  const clusters = Array.isArray(window.CLUSTERS) ? window.CLUSTERS : [];
  const categoryOrder = Array.isArray(window.CATEGORY_ORDER) ? window.CATEGORY_ORDER : [];
  const mapView = window.MAP_VIEW || null;
  const routes = Array.isArray(window.ROUTES) ? window.ROUTES : [];
  const stickers = Array.isArray(window.STICKERS) ? window.STICKERS.filter((item) => item && item.src) : [];
  const stickerEvery = Number.isFinite(window.STICKER_EVERY) ? Math.max(0, window.STICKER_EVERY) : 2;
  const scatterStickers = Array.isArray(window.SCATTER_STICKERS)
    ? window.SCATTER_STICKERS.filter((item) => item && item.src)
    : [];

  const searchInput = document.querySelector("#search");
  const clearSearchButton = document.querySelector("#clear-search");
  const categoryFilters = document.querySelector("#category-filters");
  const subFilters = document.querySelector("#sub-filters");
  const sortSelect = document.querySelector("#sort");
  const placesContainer = document.querySelector("#places");
  const resultCount = document.querySelector("#result-count");
  const activeArea = document.querySelector("#active-area");
  const emptyState = document.querySelector("#empty-state");
  const resetFiltersButton = document.querySelector("#reset-filters");
  const mapFigure = document.querySelector("#area-map-figure");
  const areaIndex = document.querySelector("#area-index");
  const toast = document.querySelector("#toast");
  const state = {
    query: "",
    category: "",
    facets: new Set(),
    brands: new Set(),
    tags: new Set(),
    cities: new Set(),
    area: "",
    mustGo: false,
    sort: "area",
    place: ""
  };

  // 只有「剛從網址進來」才需要捲動定位，之後重繪不再跳
  app.pendingPlaceFocus = false;
  app.highlightTimer = 0;

  const areaBySlug = new Map(areas.map((area) => [area.slug, area]));
  const clusterBySlug = new Map(clusters.map((cluster) => [cluster.slug, cluster]));
  const clusterRank = new Map(clusters.map((cluster, index) => [cluster.slug, index]));
  const areaRank = new Map(areas.map((area, index) => [area.slug, index]));

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase();
  }

  /** 穩定的雜湊，用來固定每張卡片的紙張與紙膠帶樣式，重繪時不會跳動 */
  function hashOf(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  /**
   * 印章一律由資料推導，不另外憑空標記。
   * visited / favorite 為選填布林欄位，未設定就不會蓋章。
   */
  function stampsOf(place) {
    const tags = new Set((place.tags || []).map(normalize));
    const stamps = [];

    if (place.visited || place.visitedAt) stamps.push({ label: "Visited", tone: "ink" });
    if (!place.visited && !place.visitedAt && place.plannedAt) {
      stamps.push({ label: "Planned", tone: "ink" });
    }
    if (place.favorite) stamps.push({ label: "Favourite", tone: "accent" });
    if (place.recommended || tags.has("recommended") || tags.has("chef")) {
      stamps.push({ label: "Recommended", tone: "accent" });
    }
    if (tags.has("tv")) stamps.push({ label: "On TV", tone: "ink" });
    if (tags.has("queue")) stamps.push({ label: "Expect a queue", tone: "ink" });

    // 一張卡最多兩枚，避免變成貼紙牆
    return stamps.slice(0, 2);
  }

  /** subcategory 以 " / " 分隔，拆成可獨立篩選的細分類 */
  function facetsOf(place) {
    return String(place.subcategory || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  /** 沒有對應 area 定義時，退回以 areaSlug 自成一群，確保舊資料仍可 render */
  function clusterSlugOf(place) {
    const area = areaBySlug.get(place.areaSlug);
    return (area && area.cluster) || place.areaSlug || "other";
  }

  function clusterLabel(slug, fallbackPlace) {
    const cluster = clusterBySlug.get(slug);
    if (cluster) return cluster;
    return { slug: slug, name: (fallbackPlace && fallbackPlace.area) || slug, roman: "" };
  }

  function areaLabel(place) {
    const area = areaBySlug.get(place.areaSlug);
    if (!area) return place.area || place.areaSlug;
    return `${area.name} ${area.roman}`.trim();
  }

  // ---------------------------------------------------------------- derive

  /** 可選分類完全由資料 derive，CATEGORY_ORDER 只影響排序 */
  function deriveCategories() {
    const seen = new Map();
    places.forEach((place) => {
      if (!place.category) return;
      if (!seen.has(place.category)) seen.set(place.category, 0);
      seen.set(place.category, seen.get(place.category) + 1);
    });

    return [...seen.keys()].sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai !== bi) return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      return a.localeCompare(b, "en");
    });
  }

  /** 第二層選項：目前分類底下實際出現過的 subcategory 與品牌 */
  function deriveSubOptions(category) {
    if (!category) return [];

    const scoped = places.filter((place) => normalize(place.category) === normalize(category));
    const facetCounts = new Map();
    const brandCounts = new Map();

    scoped.forEach((place) => {
      facetsOf(place).forEach((facet) => facetCounts.set(facet, (facetCounts.get(facet) || 0) + 1));
      if (place.brand) brandCounts.set(place.brand, (brandCounts.get(place.brand) || 0) + 1);
    });

    const options = [...facetCounts.entries()].map(([label, count]) => ({ type: "facet", label, count }));

    // 品牌只有在同分類出現多次時才值得成為篩選條件
    [...brandCounts.entries()].forEach(([label, count]) => {
      if (count > 1) options.push({ type: "brand", label, count });
    });

    return options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));
  }

  // ------------------------------------------------------------ url state

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    state.category = params.get("category") || "";
    state.area = normalize(params.get("area"));
    state.mustGo = params.get("mustGo") === "1";
    state.sort = params.get("sort") === "name" ? "name" : "area";
    state.place = params.get("place") || "";
    app.pendingPlaceFocus = Boolean(state.place);

    params.getAll("sub").filter(Boolean).forEach((sub) => state.facets.add(normalize(sub)));
    params.getAll("brand").filter(Boolean).forEach((brand) => state.brands.add(normalize(brand)));
    params.getAll("tag").filter(Boolean).forEach((tag) => state.tags.add(normalize(tag)));
    params.getAll("city").filter(Boolean).forEach((city) => state.cities.add(normalize(city)));

    // 網址帶了不存在的分類時視為未篩選
    if (state.category && !deriveCategories().some((name) => normalize(name) === normalize(state.category))) {
      state.category = "";
    }
  }

  function writeUrlState() {
    const params = new URLSearchParams();

    if (state.query) params.set("q", state.query);
    if (state.category) params.set("category", state.category);
    if (state.area) params.set("area", state.area);
    if (state.mustGo) params.set("mustGo", "1");
    state.facets.forEach((facet) => params.append("sub", facet));
    state.brands.forEach((brand) => params.append("brand", brand));
    state.tags.forEach((tag) => params.append("tag", tag));
    state.cities.forEach((city) => params.append("city", city));
    if (state.sort !== "area") params.set("sort", state.sort);
    // place 只有在使用者明確離開單一店家情境時才會被清掉（見 leavePlaceContext）
    if (state.place) params.set("place", state.place);

    const queryString = params.toString();
    const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }

  // -------------------------------------------------------------- filters

  function matchesQuery(place) {
    if (!state.query) return true;

    const searchableFields = [
      place.name,
      place.koreanName,
      place.category,
      place.subcategory,
      place.area,
      place.district,
      place.address,
      place.notes,
      place.source,
      place.brand,
      place.city,
      clusterLabel(clusterSlugOf(place), place).name,
      ...(place.tags || [])
    ];

    return normalize(searchableFields.filter(Boolean).join(" ")).includes(normalize(state.query));
  }

  function matchesFilters(place) {
    const placeTags = new Set((place.tags || []).map(normalize));
    const placeFacets = facetsOf(place).map(normalize);

    const matchesCategory = !state.category || normalize(place.category) === normalize(state.category);
    const matchesFacet = state.facets.size === 0 || placeFacets.some((facet) => state.facets.has(facet));
    const matchesBrand = state.brands.size === 0 || state.brands.has(normalize(place.brand));
    const hasEveryTag = [...state.tags].every((tag) => placeTags.has(tag));
    const matchesCity = state.cities.size === 0 || state.cities.has(normalize(place.city));
    const matchesArea = !state.area || normalize(place.areaSlug) === state.area || placeTags.has(state.area);
    const matchesMustGo = !state.mustGo || place.mustGo === true;

    return matchesCategory && matchesFacet && matchesBrand && hasEveryTag && matchesCity
      && matchesArea && matchesMustGo;
  }

  function getVisiblePlaces() {
    return places.filter((place) => matchesQuery(place) && matchesFilters(place));
  }


  Object.assign(app, {
    places, areas, clusters, categoryOrder, mapView, routes, stickers, stickerEvery, scatterStickers,
    searchInput, clearSearchButton, categoryFilters, subFilters, sortSelect, placesContainer,
    resultCount, activeArea, emptyState, resetFiltersButton, mapFigure, areaIndex, toast,
    state, areaBySlug, clusterBySlug, clusterRank, areaRank,
    normalize, hashOf, stampsOf, facetsOf, clusterSlugOf, clusterLabel, areaLabel,
    deriveCategories, deriveSubOptions, readUrlState, writeUrlState,
    matchesQuery, matchesFilters, getVisiblePlaces
  });
})(window.SeoulGuide);
