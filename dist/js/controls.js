(function (app) {
  "use strict";

  const {
    categoryFilters, subFilters, searchInput, clearSearchButton, sortSelect, activeArea,
    state, normalize, deriveCategories, deriveSubOptions, leavePlaceContext, createElement
  } = app;
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
      app.render();
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
        app.render();
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
        app.render();
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


  Object.assign(app, { renderCategoryChips, renderSubChips, syncControls });
})(window.SeoulGuide);
