(function () {
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
    sort: "area",
    place: ""
  };

  // 只有「剛從網址進來」才需要捲動定位，之後重繪不再跳
  let pendingPlaceFocus = false;
  let highlightTimer = 0;

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
    state.sort = params.get("sort") === "name" ? "name" : "area";
    state.place = params.get("place") || "";
    pendingPlaceFocus = Boolean(state.place);

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

  /** 旅行記錄：全部選填，沒有就不 render */
  function travelMetaOf(place) {
    const items = [];
    if (place.tripDay) items.push(`Day ${place.tripDay}`);
    if (place.visitedAt) items.push(`Visited ${place.visitedAt}`);
    else if (place.plannedAt) items.push(`Planned ${place.plannedAt}`);
    return items;
  }

  /**
   * 照片插頁：polaroid / contact / ticket 三種。
   * 沒有 photo 欄位就回傳 null，完全不 render。
   */
  function createPhoto(place) {
    const photo = place.photo;
    if (!photo) return null;

    const style = normalize(photo.style) || "polaroid";
    const figure = createElement("figure", `card-photo is-${style}`);

    if (style === "contact") {
      const srcs = (Array.isArray(photo.srcs) ? photo.srcs : [photo.src]).filter(Boolean);
      if (!srcs.length) return null;
      const strip = createElement("div", "contact-strip");
      srcs.slice(0, 4).forEach((src) => {
        const frame = createElement("span", "contact-frame");
        const img = document.createElement("img");
        img.src = src;
        img.alt = photo.caption ? `${place.name}：${photo.caption}` : place.name;
        img.loading = "lazy";
        frame.append(img);
        strip.append(frame);
      });
      figure.append(strip);
    } else if (style === "ticket") {
      const slip = createElement("div", "ticket-slip");
      if (photo.src) {
        const img = document.createElement("img");
        img.src = photo.src;
        img.alt = photo.caption ? `${place.name}：${photo.caption}` : place.name;
        img.loading = "lazy";
        slip.append(img);
      }
      figure.append(slip);
    } else {
      if (!photo.src) return null;
      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.caption ? `${place.name}：${photo.caption}` : place.name;
      img.loading = "lazy";
      figure.append(img);
    }

    if (photo.caption) {
      figure.append(createElement("figcaption", "", photo.caption));
    }
    return figure;
  }

  /**
   * 螢光筆顏色：優先用資料給的 noteColor，否則依 tags 保守推導。
   * yellow 推薦 / green 順路 / pink 個人偏好 / blue 時間與排隊等提醒
   */
  const NOTE_COLORS = ["yellow", "green", "pink", "blue"];

  function noteColorOf(place) {
    const explicit = normalize(place.noteColor);
    if (NOTE_COLORS.includes(explicit)) return explicit;

    const tags = new Set((place.tags || []).map(normalize));
    if (place.favorite) return "pink";
    if (tags.has("queue")) return "blue";
    if (tags.has("nature") || tags.has("attraction")) return "green";
    return "yellow";
  }

  /**
   * 主要註記只有一段，長句改用底線式筆觸，避免整段被塗滿而難讀。
   * noteStyle 可明確指定 marker / underline / plain。
   */
  function noteStyleOf(place, text) {
    const explicit = normalize(place.noteStyle);
    if (["marker", "underline", "plain"].includes(explicit)) return explicit;
    return text.length > 24 ? "underline" : "marker";
  }

  /**
   * MY NOTE 區塊。personalNote 優先成為被標記的那一段，
   * notes 則作為未標記的補充；兩者皆無就不 render。
   */
  function createNote(place) {
    const primary = place.personalNote || place.notes;
    if (!primary) return null;

    const secondary = place.personalNote && place.notes ? place.notes : "";
    const style = noteStyleOf(place, primary);

    const block = createElement("div", "card-note");
    block.dataset.noteColor = noteColorOf(place);
    block.dataset.noteStyle = style;

    const body = createElement("p", "card-note-body");
    if (style === "plain") {
      body.textContent = primary;
    } else {
      body.append(createElement("span", "note-mark", primary));
    }

    block.append(createElement("p", "card-note-label", "My note"), body);
    if (secondary) block.append(createElement("p", "card-note-extra", secondary));
    return block;
  }

  // ------------------------------------------------------- copy / share

  /** 先用 Clipboard API，不可用時退回 textarea + execCommand */
  async function copyText(text) {
    const value = String(text || "");
    if (!value) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        // 使用者拒絕權限或非安全環境，往下走 fallback
      }
    }

    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "0";
      field.style.left = "0";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      field.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      field.remove();
      return ok;
    } catch (error) {
      return false;
    }
  }

  let toastTimer = 0;

  /** 便條式的提示，本身就是 aria-live 區域 */
  function showToast(message, tone) {
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.tone = tone || "ok";
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toast.textContent = "";
    }, tone === "error" ? 2600 : 1800);
  }

  /** 單一店家的永久連結，保留目前的篩選狀態 */
  function permalinkOf(place) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("place", place.id);
      return url.toString();
    } catch (error) {
      return `${window.location.origin}${window.location.pathname}?place=${encodeURIComponent(place.id)}`;
    }
  }

  function shareTextOf(place) {
    const lines = [place.koreanName || place.name];
    if (place.koreanName && place.name) lines.push(place.name);
    if (place.address) lines.push(place.address);
    if (place.naverMapUrl) lines.push(`NAVER: ${place.naverMapUrl}`);
    return lines.filter(Boolean).join("\n");
  }

  async function sharePlace(place) {
    const url = permalinkOf(place);
    const text = shareTextOf(place);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${place.koreanName || place.name} — Seoul Guide`, text, url });
        return;
      } catch (error) {
        // 使用者按取消屬於正常操作，不提示也不 fallback
        if (error && (error.name === "AbortError" || error.name === "NotAllowedError")) return;
      }
    }

    const ok = await copyText(`${text}\n${url}`);
    showToast(ok ? "分享連結已複製 ✓" : "無法複製，請手動選取網址", ok ? "ok" : "error");
  }

  // ------------------------------------------------------- place 定位

  /** 使用者主動換條件時才離開單一店家情境 */
  function leavePlaceContext() {
    state.place = "";
    pendingPlaceFocus = false;
    clearHighlight();
  }

  function clearHighlight() {
    window.clearTimeout(highlightTimer);
    placesContainer.querySelectorAll(".place-card.is-linked").forEach((card) => {
      card.classList.remove("is-linked");
      const tag = card.querySelector(".linked-tag");
      if (tag) tag.remove();
    });
  }

  /** 網址帶 ?place=id 時捲到該卡並短暫標記；找不到就安靜略過 */
  function focusLinkedPlace() {
    if (!pendingPlaceFocus || !state.place) return;
    pendingPlaceFocus = false;

    const card = placesContainer.querySelector(`.place-card[data-place-id="${CSS.escape(state.place)}"]`);
    if (!card) return;

    clearHighlight();
    card.classList.add("is-linked");
    card.append(createElement("span", "linked-tag", "分享的店家"));
    card.setAttribute("tabindex", "-1");
    card.focus({ preventScroll: true });

    // 載入當下直接 scrollIntoView 會被瀏覽器的捲動還原蓋掉，
    // 改成下一影格自己算位置，並在延後載入的圖片撐開版面後再校正一次
    const scrollToCard = () => {
      const rect = card.getBoundingClientRect();
      const offset = Math.max(24, (window.innerHeight - rect.height) / 2);
      window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - offset), behavior: "smooth" });
    };

    window.requestAnimationFrame(scrollToCard);
    window.setTimeout(scrollToCard, 700);

    highlightTimer = window.setTimeout(clearHighlight, 6000);
  }

  function createToolButton(label, accessibleLabel, handler) {
    const button = createElement("button", "card-tool", label);
    button.type = "button";
    button.setAttribute("aria-label", accessibleLabel);
    button.addEventListener("click", () => {
      // handler 可能是 async，錯誤一律轉成提示，不讓它冒泡成未捕捉例外
      Promise.resolve()
        .then(handler)
        .catch(() => showToast("操作失敗，請再試一次", "error"));
    });
    return button;
  }

  function createPlaceCard(place, index) {
    const article = createElement("article", "place-card");
    article.dataset.placeId = place.id;

    const seed = hashOf(place.id);
    article.dataset.paper = String(seed % 6);
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

    // FACTS：一律維持排版體
    const details = createElement("dl", "place-details");
    appendDetail(details, "Area", place.area);
    appendDetail(details, "Address", place.address);
    appendDetail(details, "Hours", place.openingHours);
    appendDetail(details, "Source", place.source);
    article.append(details);

    const meta = travelMetaOf(place);
    if (meta.length) {
      const metaRow = createElement("p", "card-travel");
      meta.forEach((item, position) => {
        if (position) metaRow.append(createElement("span", "card-travel-sep", "·"));
        metaRow.append(createElement("span", "", item));
      });
      article.append(metaRow);
    }

    const photo = createPhoto(place);
    if (photo) article.append(photo);

    const note = createNote(place);
    if (note) article.append(note);

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

    const actions = createElement("div", "card-actions");

    if (place.naverMapUrl) {
      const link = createElement("a", "map-link", "NAVER Map");
      link.href = place.naverMapUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `在新分頁開啟 ${place.name} 的 NAVER Map`);
      actions.append(link);
    } else if (place.koreanName || place.name) {
      // 沒有確切的 NAVER 連結時只給關鍵字搜尋，不臆造 place id
      const query = [place.koreanName || place.name, place.address].filter(Boolean).join(" ");
      const link = createElement("a", "map-link is-search", "NAVER 搜尋");
      link.href = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `在新分頁以關鍵字搜尋 ${place.name}`);
      actions.append(link);
    }

    // 次要動作：只用文字，不做成第二排主按鈕
    const tools = createElement("div", "card-tools");

    const nameValue = place.koreanName || place.name;
    if (nameValue) {
      tools.append(
        createToolButton("이름 복사", `複製店名 ${nameValue}`, async () => {
          const ok = await copyText(nameValue);
          showToast(ok ? "店名已複製 ✓" : "複製失敗，請長按選取店名", ok ? "ok" : "error");
        })
      );
    }

    if (place.address) {
      tools.append(
        createToolButton("주소 복사", `複製 ${place.name} 的地址`, async () => {
          const ok = await copyText(place.address);
          showToast(ok ? "地址已複製 ✓" : "複製失敗，請長按選取地址", ok ? "ok" : "error");
        })
      );
    }

    tools.append(
      createToolButton("공유", `分享 ${place.name}`, () => sharePlace(place))
    );

    actions.append(tools);
    article.append(actions);

    return article;
  }

  /** 章節小標：由該群實際有的分類組出來，像手帳上隨手寫的一行 */
  function taglineOf(groupPlaces) {
    const counts = new Map();
    groupPlaces.forEach((place) => {
      if (!place.category) return;
      counts.set(place.category, (counts.get(place.category) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
      .slice(0, 2)
      .map(([name]) => name.toLowerCase())
      .join(" + ");
  }

  /**
   * 章節邊欄的裝飾貼紙。沒有 STICKERS 資料就完全不產生節點。
   * 依章節序號輪流取用，重繪時位置固定不會亂跳。
   */
  function createSticker(rank) {
    if (!stickers.length || !stickerEvery || rank % stickerEvery !== 0) return null;

    const sticker = stickers[Math.floor(rank / stickerEvery) % stickers.length];
    const image = document.createElement("img");
    image.className = "page-sticker";
    // 手機不顯示貼紙，所以也不要下載：等版面夠寬才補上 src
    image.dataset.src = sticker.src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");
    if (sticker.width) image.style.width = `${sticker.width}px`;
    image.style.setProperty("--sticker-tilt", `${sticker.tilt || 0}deg`);
    // 同一章節固定的落點，看起來像隨手貼上去但不會蓋到文字
    image.style.setProperty("--sticker-drop", `${1.4 + ((rank * 37) % 4) * 0.5}rem`);
    image.style.setProperty("--sticker-indent", `${((rank * 53) % 5) * 0.45}rem`);
    return image;
  }

  /**
   * 背景散落的貼紙：沿頁面往下平均分佈、左右交錯，塞在卡片後面，
   * 只從頁緣露出一角，所以不會蓋到任何文字。沒有資料就不產生節點。
   */
  function renderScatter() {
    const existing = placesContainer.querySelector(".scatter-layer");
    if (existing) existing.remove();
    if (!scatterStickers.length) return;

    const layer = createElement("div", "scatter-layer");
    layer.setAttribute("aria-hidden", "true");

    scatterStickers.forEach((sticker, index) => {
      const seed = hashOf(sticker.src);
      const image = document.createElement("img");
      image.className = "scatter-sticker";
      image.dataset.src = sticker.src;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      // 一律靠右：右側是不透明的卡片欄，貼紙只會從卡片邊緣露出一角；
      // 左欄有章節標題文字，放了會擋住字
      image.classList.add("is-right");
      if (sticker.width) image.style.width = `${sticker.width}px`;
      image.style.setProperty("--sticker-tilt", `${sticker.tilt || 0}deg`);
      // 沿頁面平均分佈再加一點固定的偏移，看起來像隨手貼的
      const band = (index + 0.5) / scatterStickers.length * 100;
      image.style.setProperty("--scatter-y", `${(band + ((seed % 7) - 3) * 0.7).toFixed(2)}%`);
      image.style.setProperty("--scatter-x", `-${(0.5 + (seed % 5) * 0.4).toFixed(2)}rem`);
      layer.append(image);
    });

    placesContainer.append(layer);
  }

  /** 版面夠寬時才真的載入貼紙圖，避免手機白白下載用不到的裝飾 */
  function hydrateStickers() {
    if ((!stickers.length && !scatterStickers.length) || typeof window.matchMedia !== "function") return;

    const wide = window.matchMedia("(min-width: 768px)");
    const load = () => {
      if (!wide.matches) return;
      document.querySelectorAll(".page-sticker[data-src], .scatter-sticker[data-src]").forEach((image) => {
        image.src = image.dataset.src;
        delete image.dataset.src;
      });
    };

    load();
    if (typeof wide.addEventListener === "function") wide.addEventListener("change", load);
  }

  function renderGroupedPlaces(visiblePlaces) {
    let pageNumber = 0;
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

      const rank = clusterRank.has(slug) ? clusterRank.get(slug) : 0;
      const header = createElement("header", "group-header");
      header.dataset.tab = String(rank % 7);
      header.dataset.doodle = String(rank % 7);
      header.append(
        createElement("p", "group-index", String(rank + 1).padStart(2, "0")),
        heading
      );
      if (label.roman) header.append(createElement("p", "group-roman", label.roman));

      const tagline = taglineOf(groupPlaces);
      if (tagline) header.append(createElement("p", "group-tagline", tagline));
      header.append(
        createElement("p", "group-count", `${groupPlaces.length} ${groupPlaces.length === 1 ? "place" : "places"}`)
      );
      // 章節副標，選填，由 CLUSTERS[].note 提供
      if (label.note) header.append(createElement("p", "group-note", label.note));

      // 裝飾貼紙放在章節文字全部排完之後
      const sticker = createSticker(rank);
      if (sticker) header.append(sticker);

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

      pageNumber += groupPlaces.length;
      const folio = createElement("p", "group-folio");
      folio.append(createElement("span", "", String(pageNumber).padStart(3, "0")));
      section.append(folio);

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
      leavePlaceContext();
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
        leavePlaceContext();
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
        leavePlaceContext();
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

  /**
   * 手繪風路線：只把 AREAS 的座標連起來，不做任何真實路徑規劃。
   * 控制點稍微偏移做出手繪的抖動，並在每段中點畫一個箭頭。
   */
  function renderRoutes(svgNode) {
    const layer = svgNode && svgNode.querySelector("#map-routes");
    const legend = document.querySelector("#route-legend");
    if (!layer) return;

    layer.replaceChildren();
    if (legend) {
      legend.replaceChildren();
      legend.hidden = true;
    }
    if (!routes.length) return;

    const svgEl = (name) => document.createElementNS("http://www.w3.org/2000/svg", name);
    const point = (slug) => {
      const area = areaBySlug.get(slug);
      if (!area) return null;
      const nudge = area.nudge || {};
      return {
        x: ((area.lng - mapView.west) / (mapView.east - mapView.west)) * mapView.width + (nudge.x || 0),
        y: ((mapView.north - area.lat) / (mapView.north - mapView.south)) * mapView.height + (nudge.y || 0)
      };
    };

    let drawn = 0;
    routes.forEach((route, routeIndex) => {
      const stops = (route.stops || []).map(point).filter(Boolean);
      if (stops.length < 2) return;

      const tone = normalize(route.tone) === "ink" ? "ink" : "accent";
      const group = svgEl("g");
      group.setAttribute("class", `map-route is-${tone}`);

      // 每段用一個二次貝茲，控制點依固定偏移錯開，看起來像手繪
      let d = `M${stops[0].x.toFixed(1)} ${stops[0].y.toFixed(1)}`;
      for (let i = 1; i < stops.length; i += 1) {
        const from = stops[i - 1];
        const to = stops[i];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const bow = (i % 2 ? 1 : -1) * Math.min(26, length * 0.12);
        d += ` Q${(midX - (dy / length) * bow).toFixed(1)} ${(midY + (dx / length) * bow).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      }
      const path = svgEl("path");
      path.setAttribute("class", "route-line");
      path.setAttribute("d", d);
      group.append(path);

      // 段落中點的方向箭頭
      for (let i = 1; i < stops.length; i += 1) {
        const from = stops[i - 1];
        const to = stops[i];
        const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
        const arrow = svgEl("path");
        arrow.setAttribute("class", "route-arrow");
        arrow.setAttribute("d", "M-5 -4 L4 0 L-5 4");
        arrow.setAttribute(
          "transform",
          `translate(${((from.x + to.x) / 2).toFixed(1)} ${((from.y + to.y) / 2).toFixed(1)}) rotate(${angle.toFixed(1)})`
        );
        group.append(arrow);
      }

      // DAY 標註放在起點旁
      const label = svgEl("text");
      label.setAttribute("class", "route-label");
      label.setAttribute("x", (stops[0].x + 14).toFixed(1));
      label.setAttribute("y", (stops[0].y - 16).toFixed(1));
      label.textContent = route.label || `DAY ${String(route.day || routeIndex + 1).padStart(2, "0")}`;
      group.append(label);

      layer.append(group);
      drawn += 1;

      if (legend) {
        const item = document.createElement("li");
        item.className = `is-${tone}`;
        item.textContent = label.textContent;
        legend.append(item);
      }
    });

    if (legend) legend.hidden = drawn === 0;
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

    renderRoutes(mapFigure.querySelector("svg"));

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
    renderScatter();
    syncControls();
    writeUrlState();
    hydrateStickers();
    focusLinkedPlace();
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
    leavePlaceContext();
    render();
    searchInput.focus();
  }

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trimStart();
    leavePlaceContext();
    render();
  });

  clearSearchButton.addEventListener("click", () => {
    state.query = "";
    leavePlaceContext();
    render();
    searchInput.focus();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    leavePlaceContext();
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

  // 自行控制捲動位置，避免瀏覽器還原的捲動蓋掉 ?place= 的定位
  if ("scrollRestoration" in window.history) {
    try {
      window.history.scrollRestoration = "manual";
    } catch (error) {
      // 某些瀏覽器唯讀，忽略即可
    }
  }

  renderAreaMap();
  readUrlState();
  render();
})();
