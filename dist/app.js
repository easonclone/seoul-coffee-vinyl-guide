(function () {
  "use strict";

  const places = Array.isArray(window.PLACES) ? window.PLACES.filter((place) => place.active !== false) : [];
  const areas = Array.isArray(window.AREAS) ? window.AREAS : [];
  const clusters = Array.isArray(window.CLUSTERS) ? window.CLUSTERS : [];
  const categoryOrder = Array.isArray(window.CATEGORY_ORDER) ? window.CATEGORY_ORDER : [];
  const mapView = window.MAP_VIEW || null;

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

  const state = {
    query: "",
    category: "",
    facets: new Set(),
    brands: new Set(),
    tags: new Set(),
    cities: new Set(),
    area: "",
    sort: "area"
  };

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

    if (place.visited) stamps.push({ label: "Visited", tone: "ink" });
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
    state.sort = params.get("sort") === "name" ? "name" : "area";

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
    state.facets.forEach((facet) => params.append("sub", facet));
    state.brands.forEach((brand) => params.append("brand", brand));
    state.tags.forEach((tag) => params.append("tag", tag));
    state.cities.forEach((city) => params.append("city", city));
    if (state.sort !== "area") params.set("sort", state.sort);

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

    return matchesCategory && matchesFacet && matchesBrand && hasEveryTag && matchesCity && matchesArea;
  }

  function getVisiblePlaces() {
    return places.filter((place) => matchesQuery(place) && matchesFilters(place));
  }

  // ----------------------------------------------------------------- dom

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function appendDetail(list, label, value) {
    if (!value) return;

    const row = createElement("div", "detail-row");
    row.append(createElement("dt", "", label), createElement("dd", "", value));
    list.append(row);
  }

  function createPlaceCard(place, index) {
    const article = createElement("article", "place-card");
    article.dataset.placeId = place.id;

    const seed = hashOf(place.id);
    article.dataset.paper = String(seed % 4);
    article.dataset.tape = String((seed >>> 5) % 3);

    const topline = createElement("div", "card-topline");
    const kind = createElement("span", "card-kind");
    const sticker = createElement("b", "card-sticker", place.category);
    sticker.dataset.category = normalize(place.category);
    kind.append(sticker);
    if (place.subcategory) kind.append(createElement("i", "card-sub", place.subcategory));
    topline.append(createElement("span", "card-index", String(index + 1).padStart(2, "0")), kind);

    article.append(topline, createElement("h3", "", place.name));
    if (place.koreanName) {
      article.append(createElement("p", "korean-name", place.koreanName));
    }

    const details = createElement("dl", "place-details");
    appendDetail(details, "Area", place.area);
    appendDetail(details, "Address", place.address);
    appendDetail(details, "Hours", place.openingHours);
    appendDetail(details, "Source", place.source);
    article.append(details);

    // 個人備註才用手寫體呈現，其餘欄位維持排版體
    if (place.notes) {
      article.append(createElement("p", "card-note", place.notes));
    }

    if (Array.isArray(place.tags) && place.tags.length) {
      const tags = createElement("ul", "tags");
      place.tags.forEach((tag) => tags.append(createElement("li", "", tag)));
      article.append(tags);
    }

    const stamps = stampsOf(place);
    if (stamps.length) {
      const stampRow = createElement("div", "card-stamps");
      stamps.forEach((stamp) => {
        const mark = createElement("span", `stamp is-${stamp.tone}`, stamp.label);
        stampRow.append(mark);
      });
      article.append(stampRow);
    }

    if (place.naverMapUrl) {
      const link = createElement("a", "map-link", "NAVER Map");
      link.href = place.naverMapUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `在新分頁開啟 ${place.name} 的 NAVER Map`);
      article.append(link);
    } else if (place.koreanName || place.name) {
      // 沒有確切的 NAVER 連結時只給關鍵字搜尋，不臆造 place id
      const query = [place.koreanName || place.name, place.address].filter(Boolean).join(" ");
      const link = createElement("a", "map-link is-search", "NAVER 搜尋");
      link.href = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `在新分頁以關鍵字搜尋 ${place.name}`);
      article.append(link);
    }

    return article;
  }

  function renderGroupedPlaces(visiblePlaces) {
    const grouped = visiblePlaces.reduce((groups, place) => {
      const slug = clusterSlugOf(place);
      if (!groups.has(slug)) groups.set(slug, []);
      groups.get(slug).push(place);
      return groups;
    }, new Map());

    const sortedSlugs = [...grouped.keys()].sort((a, b) => {
      const ai = clusterRank.has(a) ? clusterRank.get(a) : Infinity;
      const bi = clusterRank.has(b) ? clusterRank.get(b) : Infinity;
      return ai - bi;
    });

    sortedSlugs.forEach((slug) => {
      const groupPlaces = grouped.get(slug);
      const label = clusterLabel(slug, groupPlaces[0]);
      const section = createElement("section", "place-group");
      const headingId = `cluster-${slug}`;
      const heading = createElement("h2", "", label.name);
      heading.id = headingId;

      const header = createElement("header", "group-header");
      header.append(
        createElement("p", "group-index", String((clusterRank.get(slug) || 0) + 1).padStart(2, "0")),
        heading
      );
      if (label.roman) header.append(createElement("p", "group-roman", label.roman));
      header.append(
        createElement("p", "", `${groupPlaces.length} ${groupPlaces.length === 1 ? "place" : "places"}`)
      );

      section.setAttribute("aria-labelledby", headingId);
      section.append(header);

      // cluster 底下再依 area 分段，保留既有的 #area-<slug> 錨點
      const byArea = groupPlaces.reduce((areasMap, place) => {
        if (!areasMap.has(place.areaSlug)) areasMap.set(place.areaSlug, []);
        areasMap.get(place.areaSlug).push(place);
        return areasMap;
      }, new Map());

      [...byArea.keys()]
        .sort((a, b) => {
          const ai = areaRank.has(a) ? areaRank.get(a) : Infinity;
          const bi = areaRank.has(b) ? areaRank.get(b) : Infinity;
          return ai - bi;
        })
        .forEach((areaSlug) => {
          const areaPlaces = byArea.get(areaSlug);
          const block = createElement("div", "area-block");
          const areaHeading = createElement("h3", "area-heading", areaLabel(areaPlaces[0]));
          areaHeading.id = `area-${areaSlug}`;

          const grid = createElement("div", "card-grid");
          areaPlaces.forEach((place) => grid.append(createPlaceCard(place, places.indexOf(place))));
          block.append(areaHeading, grid);
          section.append(block);
        });

      placesContainer.append(section);
    });
  }

  function renderNameSortedPlaces(visiblePlaces) {
    const grid = createElement("section", "name-grid");
    grid.setAttribute("aria-label", "依店名排序的店家");

    [...visiblePlaces]
      .sort((placeA, placeB) => placeA.name.localeCompare(placeB.name, "en"))
      .forEach((place) => grid.append(createPlaceCard(place, places.indexOf(place))));

    placesContainer.append(grid);
  }

  // --------------------------------------------------------- filter chips

  function createChip(label, isActive) {
    const button = createElement("button", "filter-chip", label);
    button.type = "button";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    return button;
  }

  function renderCategoryChips() {
    categoryFilters.replaceChildren();

    const allChip = createChip("全部", !state.category);
    allChip.addEventListener("click", () => {
      state.category = "";
      state.facets.clear();
      state.brands.clear();
      render();
    });
    categoryFilters.append(allChip);

    deriveCategories().forEach((category) => {
      const isActive = normalize(state.category) === normalize(category);
      const chip = createChip(category, isActive);
      chip.addEventListener("click", () => {
        state.category = isActive ? "" : category;
        state.facets.clear();
        state.brands.clear();
        render();
      });
      categoryFilters.append(chip);
    });
  }

  function renderSubChips() {
    subFilters.replaceChildren();

    const options = deriveSubOptions(state.category);
    // 只有一個選項時篩選沒有意義
    if (options.length < 2) {
      subFilters.hidden = true;
      return;
    }

    subFilters.hidden = false;
    options.forEach((option) => {
      const collection = option.type === "brand" ? state.brands : state.facets;
      const value = normalize(option.label);
      const isActive = collection.has(value);
      const chip = createChip(option.label, isActive);
      chip.classList.add(option.type === "brand" ? "is-brand" : "is-facet");
      chip.addEventListener("click", () => {
        if (collection.has(value)) {
          collection.delete(value);
        } else {
          collection.add(value);
        }
        render();
      });
      subFilters.append(chip);
    });
  }

  function syncControls() {
    searchInput.value = state.query;
    clearSearchButton.hidden = !state.query;
    sortSelect.value = state.sort;

    renderCategoryChips();
    renderSubChips();

    activeArea.hidden = !state.area;
    activeArea.textContent = state.area ? `區域：${state.area}` : "";
  }

  // ------------------------------------------------------------- area map

  function project(area) {
    const nudge = area.nudge || { x: 0, y: 0 };
    const x = ((area.lng - mapView.west) / (mapView.east - mapView.west)) * mapView.width + (nudge.x || 0);
    const y = ((mapView.north - area.lat) / (mapView.north - mapView.south)) * mapView.height + (nudge.y || 0);
    return { x: (x / mapView.width) * 100, y: (y / mapView.height) * 100 };
  }

  function renderAreaMap() {
    if (!mapFigure || !areaIndex || !mapView) return;

    const countByArea = places.reduce((totals, place) => {
      totals[place.areaSlug] = (totals[place.areaSlug] || 0) + 1;
      return totals;
    }, {});

    mapFigure.querySelectorAll(".map-node").forEach((node) => node.remove());

    // 只畫出實際有店家的區域
    areas
      .filter((area) => countByArea[area.slug] && clusterRank.has(area.cluster))
      .forEach((area) => {
        const position = project(area);
        const number = String(clusterRank.get(area.cluster) + 1).padStart(2, "0");

        const node = createElement("a", "map-node");
        node.href = `#cluster-${area.cluster}`;
        node.dataset.cluster = area.cluster;
        node.style.left = `${position.x.toFixed(2)}%`;
        node.style.top = `${position.y.toFixed(2)}%`;
        // 靠近右緣時標籤往左開，避免被裁掉
        if (position.x > 62) node.classList.add("is-left");

        const badge = createElement("i", "", number);
        const label = createElement("b", "", area.name);
        label.append(createElement("small", "", area.roman));
        node.append(badge, label);
        node.setAttribute("aria-label", `${area.name} ${area.roman}（${countByArea[area.slug]} 間）`);
        mapFigure.append(node);
      });

    // 索引以 cluster 為單位，對應地圖上的編號
    areaIndex.replaceChildren();
    clusters.forEach((cluster, index) => {
      const clusterAreas = areas.filter((area) => area.cluster === cluster.slug);
      const count = clusterAreas.reduce((total, area) => total + (countByArea[area.slug] || 0), 0);
      if (!count) return;

      const item = document.createElement("li");
      const link = createElement("a", "");
      link.href = `#cluster-${cluster.slug}`;
      link.dataset.cluster = cluster.slug;
      link.append(
        createElement("i", "", String(index + 1).padStart(2, "0")),
        createElement("b", "", cluster.name),
        createElement("small", "", cluster.roman),
        createElement("em", "", String(count))
      );

      const highlight = (isHot) => {
        mapFigure
          .querySelectorAll(`.map-node[data-cluster="${cluster.slug}"]`)
          .forEach((node) => node.classList.toggle("is-hot", isHot));
      };

      link.addEventListener("mouseenter", () => highlight(true));
      link.addEventListener("mouseleave", () => highlight(false));
      link.addEventListener("focus", () => highlight(true));
      link.addEventListener("blur", () => highlight(false));

      item.append(link);
      areaIndex.append(item);
    });
  }

  // -------------------------------------------------------------- render

  function render() {
    const visiblePlaces = getVisiblePlaces();
    placesContainer.replaceChildren();

    if (state.sort === "name") {
      renderNameSortedPlaces(visiblePlaces);
    } else {
      renderGroupedPlaces(visiblePlaces);
    }

    const countLabel = visiblePlaces.length === 1 ? "place" : "places";
    resultCount.textContent = `${visiblePlaces.length} ${countLabel}`;
    emptyState.hidden = visiblePlaces.length !== 0;
    placesContainer.hidden = visiblePlaces.length === 0;
    syncControls();
    writeUrlState();
  }

  function resetFilters() {
    state.query = "";
    state.category = "";
    state.facets.clear();
    state.brands.clear();
    state.tags.clear();
    state.cities.clear();
    state.area = "";
    state.sort = "area";
    render();
    searchInput.focus();
  }

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trimStart();
    render();
  });

  clearSearchButton.addEventListener("click", () => {
    state.query = "";
    render();
    searchInput.focus();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  resetFiltersButton.addEventListener("click", resetFilters);
  window.addEventListener("popstate", () => {
    state.facets.clear();
    state.brands.clear();
    state.tags.clear();
    state.cities.clear();
    readUrlState();
    render();
  });

  renderAreaMap();
  readUrlState();
  render();
})();
