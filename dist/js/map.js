(function (app) {
  "use strict";

  const {
    places, areas, clusters, routes, mapView, areaBySlug, clusterRank,
    mapFigure, areaIndex, normalize, createElement
  } = app;
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


  Object.assign(app, { project, renderRoutes, renderAreaMap });
})(window.SeoulGuide);

