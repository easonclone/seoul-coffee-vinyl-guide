(function () {
  "use strict";

  const places = Array.isArray(window.PLACES) ? window.PLACES.filter((place) => place.active !== false) : [];
  const searchInput = document.querySelector("#search");
  const clearSearchButton = document.querySelector("#clear-search");
  const filterButtons = Array.from(document.querySelectorAll(".filter-chip"));
  const sortSelect = document.querySelector("#sort");
  const placesContainer = document.querySelector("#places");
  const resultCount = document.querySelector("#result-count");
  const activeArea = document.querySelector("#active-area");
  const emptyState = document.querySelector("#empty-state");
  const resetFiltersButton = document.querySelector("#reset-filters");

  const state = {
    query: "",
    tags: new Set(),
    cities: new Set(),
    area: "",
    sort: "area"
  };

  const areaOrder = [...new Set(places.map((place) => place.area))];

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase();
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    state.area = normalize(params.get("area"));
    state.sort = params.get("sort") === "name" ? "name" : "area";

    params.getAll("tag").filter(Boolean).forEach((tag) => state.tags.add(normalize(tag)));
    params.getAll("city").filter(Boolean).forEach((city) => state.cities.add(normalize(city)));
  }

  function writeUrlState() {
    const params = new URLSearchParams();

    if (state.query) params.set("q", state.query);
    if (state.area) params.set("area", state.area);
    state.tags.forEach((tag) => params.append("tag", tag));
    state.cities.forEach((city) => params.append("city", city));
    if (state.sort !== "area") params.set("sort", state.sort);

    const queryString = params.toString();
    const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }

  function syncControls() {
    searchInput.value = state.query;
    clearSearchButton.hidden = !state.query;
    sortSelect.value = state.sort;

    filterButtons.forEach((button) => {
      const type = button.dataset.filterType;
      const value = normalize(button.dataset.filterValue);
      let isActive = false;

      if (type === "all") {
        isActive = state.tags.size === 0 && state.cities.size === 0 && !state.area;
      } else if (type === "tag") {
        isActive = state.tags.has(value);
      } else if (type === "city") {
        isActive = state.cities.has(value);
      }

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    activeArea.hidden = !state.area;
    activeArea.textContent = state.area ? `區域：${state.area}` : "";
  }

  function matchesQuery(place) {
    if (!state.query) return true;

    const searchableFields = [
      place.name,
      place.koreanName,
      place.category,
      place.area,
      place.district,
      place.address,
      place.notes,
      place.brand,
      place.city,
      ...(place.tags || [])
    ];

    return normalize(searchableFields.filter(Boolean).join(" ")).includes(normalize(state.query));
  }

  function matchesFilters(place) {
    const placeTags = new Set((place.tags || []).map(normalize));
    const hasEveryTag = [...state.tags].every((tag) => placeTags.has(tag));
    const matchesCity = state.cities.size === 0 || state.cities.has(normalize(place.city));
    const matchesArea = !state.area || normalize(place.areaSlug) === state.area || placeTags.has(state.area);

    return hasEveryTag && matchesCity && matchesArea;
  }

  function getVisiblePlaces() {
    return places.filter((place) => matchesQuery(place) && matchesFilters(place));
  }

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

    const topline = createElement("div", "card-topline");
    topline.append(
      createElement("span", "", String(index + 1).padStart(2, "0")),
      createElement("span", "", place.category)
    );

    article.append(topline, createElement("h3", "", place.name));
    if (place.koreanName) {
      article.append(createElement("p", "korean-name", place.koreanName));
    }

    const details = createElement("dl", "place-details");
    appendDetail(details, "Area", place.area);
    appendDetail(details, "Address", place.address);
    appendDetail(details, "Hours", place.openingHours);
    appendDetail(details, "Notes", place.notes);
    article.append(details);

    if (Array.isArray(place.tags) && place.tags.length) {
      const tags = createElement("ul", "tags");
      place.tags.forEach((tag) => tags.append(createElement("li", "", tag)));
      article.append(tags);
    }

    if (place.naverMapUrl) {
      const link = createElement("a", "map-link", "NAVER Map");
      link.href = place.naverMapUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `在新分頁開啟 ${place.name} 的 NAVER Map`);
      article.append(link);
    }

    return article;
  }

  function renderGroupedPlaces(visiblePlaces) {
    const groupedPlaces = visiblePlaces.reduce((groups, place) => {
      if (!groups.has(place.area)) groups.set(place.area, []);
      groups.get(place.area).push(place);
      return groups;
    }, new Map());

    const sortedAreas = [...groupedPlaces.keys()].sort((areaA, areaB) => {
      return areaOrder.indexOf(areaA) - areaOrder.indexOf(areaB);
    });

    sortedAreas.forEach((area, groupIndex) => {
      const groupPlaces = groupedPlaces.get(area);
      const section = createElement("section", "place-group");
      const header = createElement("header", "group-header");
      const headingId = `area-${groupPlaces[0].areaSlug}`;
      const heading = createElement("h2", "", area);
      heading.id = headingId;

      header.append(
        createElement("p", "group-index", String(groupIndex + 1).padStart(2, "0")),
        heading,
        createElement("p", "", `${groupPlaces.length} ${groupPlaces.length === 1 ? "place" : "places"}`)
      );

      const grid = createElement("div", "card-grid");
      groupPlaces.forEach((place) => grid.append(createPlaceCard(place, places.indexOf(place))));
      section.setAttribute("aria-labelledby", headingId);
      section.append(header, grid);
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

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.filterType;
      const value = normalize(button.dataset.filterValue);

      if (type === "all") {
        state.tags.clear();
        state.cities.clear();
        state.area = "";
      } else {
        const collection = type === "tag" ? state.tags : state.cities;
        collection.has(value) ? collection.delete(value) : collection.add(value);
      }

      render();
    });
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  resetFiltersButton.addEventListener("click", resetFilters);
  window.addEventListener("popstate", () => {
    state.tags.clear();
    state.cities.clear();
    readUrlState();
    render();
  });

  readUrlState();
  render();
})();
