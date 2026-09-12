(function (app) {
  "use strict";

  const {
    state, searchInput, clearSearchButton, sortSelect, placesContainer, resultCount,
    emptyState, resetFiltersButton, getVisiblePlaces, readUrlState, writeUrlState,
    leavePlaceContext, renderScatter, hydrateStickers, focusLinkedPlace,
    renderGroupedPlaces, renderNameSortedPlaces, syncControls, renderAreaMap
  } = app;
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

  app.render = render;

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


})(window.SeoulGuide);
