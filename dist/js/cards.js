(function (app) {
  "use strict";

  const {
    places, stickers, stickerEvery, scatterStickers, placesContainer, toast, state,
    clusterRank, areaRank, normalize, hashOf, stampsOf, clusterSlugOf, clusterLabel, areaLabel
  } = app;
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

  /** 推薦資訊可使用一至五星；基準店則顯示使用者指定的基準標記。 */
  function ratingLabelOf(place) {
    if (place.priority === "benchmark") return "基準";

    const rating = Number(place.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
    return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
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

  /**
   * 只複製永久連結，不使用 Web Share API。
   * 桌面版 Chrome 的 Web Share 會在呼叫時直接終止分頁
   *（Aw, Snap! / RESULT_CODE_KILLED_BAD_MESSAGE），複製連結穩定得多。
   */
  async function copyPlaceLink(place) {
    const ok = await copyText(permalinkOf(place));
    showToast(ok ? "連結已複製 ✓" : "無法複製，請手動選取網址", ok ? "ok" : "error");
  }

  // ------------------------------------------------------- place 定位

  /** 使用者主動換條件時才離開單一店家情境 */
  function leavePlaceContext() {
    state.place = "";
    app.pendingPlaceFocus = false;
    clearHighlight();
  }

  function clearHighlight() {
    window.clearTimeout(app.highlightTimer);
    placesContainer.querySelectorAll(".place-card.is-linked").forEach((card) => {
      card.classList.remove("is-linked");
      const tag = card.querySelector(".linked-tag");
      if (tag) tag.remove();
    });
  }

  /** 網址帶 ?place=id 時捲到該卡並短暫標記；找不到就安靜略過 */
  function focusLinkedPlace() {
    if (!app.pendingPlaceFocus || !state.place) return;
    app.pendingPlaceFocus = false;

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

    app.highlightTimer = window.setTimeout(clearHighlight, 6000);
  }

  function createToolButton(label, accessibleLabel, handler) {
    const button = createElement("button", "card-tool");
    button.type = "button";
    button.setAttribute("aria-label", accessibleLabel);
    button.append(createElement("span", "", label), createCopyIcon());
    button.addEventListener("click", () => {
      // 同步呼叫 handler，讓 clipboard / share 還握有這次點擊的 user activation
      try {
        const result = handler();
        if (result && typeof result.catch === "function") {
          result.catch(() => showToast("操作失敗，請再試一次", "error"));
        }
      } catch (error) {
        showToast("操作失敗，請再試一次", "error");
      }
    });
    return button;
  }

  /** 次要動作以複製圖示表達共同行為，文字只保留被複製的內容。 */
  function createCopyIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const back = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    back.setAttribute("x", "4");
    back.setAttribute("y", "4");
    back.setAttribute("width", "11");
    back.setAttribute("height", "11");
    back.setAttribute("rx", "2");

    const front = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    front.setAttribute("x", "9");
    front.setAttribute("y", "9");
    front.setAttribute("width", "11");
    front.setAttribute("height", "11");
    front.setAttribute("rx", "2");

    svg.append(back, front);
    return svg;
  }

  /** 卡片外部連結使用內建線條圖示，不依賴額外圖示套件。 */
  function createActionIcon(type) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const addShape = (name, attributes) => {
      const shape = document.createElementNS("http://www.w3.org/2000/svg", name);
      Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
      svg.append(shape);
    };

    if (type === "instagram") {
      addShape("rect", { x: "3", y: "3", width: "18", height: "18", rx: "5" });
      addShape("circle", { cx: "12", cy: "12", r: "4" });
      addShape("circle", { cx: "17.5", cy: "6.5", r: "1", class: "is-filled" });
    } else {
      addShape("circle", { cx: "12", cy: "12", r: "9" });
      addShape("path", { d: "M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" });
    }

    return svg;
  }

  function createExternalLink(place, label, url, icon) {
    if (!url) return null;

    let externalUrl;
    try {
      externalUrl = new URL(url);
      if (externalUrl.protocol !== "https:") return null;
    } catch (error) {
      return null;
    }

    const link = createElement("a", "card-external-link");
    link.href = externalUrl.toString();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `在新分頁開啟 ${place.name} 的 ${label}`);
    link.append(createActionIcon(icon), createElement("span", "", `${label} ↗`));
    return link;
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
    appendDetail(details, "Rating", ratingLabelOf(place));
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

    const externalLinks = [
      createExternalLink(place, "IG", place.instagramUrl, "instagram"),
      createExternalLink(place, "WEB", place.websiteUrl, "website")
    ].filter(Boolean);
    if (externalLinks.length) {
      const externalActions = createElement("div", "card-external-links");
      externalActions.append(...externalLinks);
      actions.append(externalActions);
    }

    // 次要動作：只用文字，不做成第二排主按鈕
    const tools = createElement("div", "card-tools");

    const nameValue = place.koreanName || place.name;
    if (nameValue) {
      tools.append(
        createToolButton("Name", `複製店名 ${nameValue}`, async () => {
          const ok = await copyText(nameValue);
          showToast(ok ? "店名已複製 ✓" : "複製失敗，請長按選取店名", ok ? "ok" : "error");
        })
      );
    }

    if (place.address) {
      tools.append(
        createToolButton("Address", `複製 ${place.name} 的地址`, async () => {
          const ok = await copyText(place.address);
          showToast(ok ? "地址已複製 ✓" : "複製失敗，請長按選取地址", ok ? "ok" : "error");
        })
      );
    }

    tools.append(
      createToolButton("Link", `複製 ${place.name} 的分享連結`, () => copyPlaceLink(place))
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


  Object.assign(app, {
    createElement, showToast, leavePlaceContext, clearHighlight, focusLinkedPlace,
    createPlaceCard, renderScatter, hydrateStickers, renderGroupedPlaces, renderNameSortedPlaces
  });
})(window.SeoulGuide);
