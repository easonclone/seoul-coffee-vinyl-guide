import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(projectRoot, "dist");
const html = fs.readFileSync(path.join(distRoot, "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !/^(?:https?:|data:|#)/.test(reference));

localReferences.forEach((reference) => {
  assert(fs.existsSync(path.join(distRoot, reference)), `找不到本機資源：${reference}`);
});

const expectedScripts = [
  "data/areas.js",
  "data/stickers.js",
  "data/places.js",
  "js/core.js",
  "js/cards.js",
  "js/controls.js",
  "js/map.js",
  "app.js"
];
const actualScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
assert(
  JSON.stringify(actualScripts) === JSON.stringify(expectedScripts),
  "JavaScript 載入順序與模組依賴不一致"
);

class FakeElement {
  constructor() {
    this.classList = {
      add() {},
      remove() {},
      toggle() {}
    };
    this.dataset = {};
    this.style = { setProperty() {} };
    this.hidden = false;
    this.value = "";
  }

  addEventListener() {}
  append() {}
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  remove() {}
  replaceChildren() {}
  setAttribute() {}
}

const body = new FakeElement();
const windowObject = {
  addEventListener() {},
  clearTimeout() {},
  history: { replaceState() {}, scrollRestoration: "auto" },
  location: {
    href: "http://localhost/",
    origin: "http://localhost",
    pathname: "/",
    search: ""
  },
  setTimeout() { return 1; }
};
const documentObject = {
  body,
  createElement() { return new FakeElement(); },
  createElementNS() { return new FakeElement(); },
  querySelector() { return new FakeElement(); },
  querySelectorAll() { return []; }
};

const context = vm.createContext({
  CSS: { escape: (value) => String(value) },
  URL,
  URLSearchParams,
  console,
  document: documentObject,
  navigator: {},
  window: windowObject
});

expectedScripts.forEach((relativePath) => {
  const source = fs.readFileSync(path.join(distRoot, relativePath), "utf8");
  new vm.Script(source, { filename: relativePath }).runInContext(context);
});

const placeIds = windowObject.PLACES.map((place) => place.id);
const areaSlugs = new Set(windowObject.AREAS.map((area) => area.slug));
const noteColors = new Set(["yellow", "green", "pink", "blue"]);
assert(new Set(placeIds).size === placeIds.length, "店家資料包含重複的 id");
windowObject.PLACES.forEach((place) => {
  assert(place.id && place.name && place.category && place.areaSlug, "店家缺少必要欄位");
  assert(areaSlugs.has(place.areaSlug), `店家使用未知的 areaSlug：${place.areaSlug}`);
  assert(
    place.rating === undefined || (Number.isInteger(place.rating) && place.rating >= 1 && place.rating <= 5),
    `店家星等必須介於一至五星：${place.id}`
  );
  assert(
    place.noteColor === undefined || noteColors.has(place.noteColor),
    `店家使用未知的 noteColor：${place.id}`
  );
  assert(
    place.mustGo === undefined || typeof place.mustGo === "boolean",
    `店家的 mustGo 必須是布林值：${place.id}`
  );
  assert(
    !place.naverMapUrl || /^https:\/\/(?:map\.naver\.com|naver\.me)\//.test(place.naverMapUrl),
    `店家的 NAVER 連結格式不正確：${place.id}`
  );
  assert(!place.naverMapUrl || !place.naverMapUrl.includes("utm_"), `NAVER 連結不應包含追蹤參數：${place.id}`);
  assert(
    !place.instagramUrl || /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/.test(place.instagramUrl),
    `店家的 Instagram 連結格式不正確：${place.id}`
  );
  assert(
    !place.websiteUrl || (place.websiteUrl.startsWith("https://") && !place.websiteUrl.includes("utm_")),
    `店家的官網連結格式不正確：${place.id}`
  );
});

assert(typeof windowObject.SeoulGuide.render === "function", "網站啟動流程未正確載入");

windowObject.location.search = "?mustGo=1";
windowObject.SeoulGuide.readUrlState();
assert(windowObject.SeoulGuide.state.mustGo === true, "網址未能還原必去篩選");
const mustGoPlaces = windowObject.SeoulGuide.getVisiblePlaces();
assert(mustGoPlaces.length > 0, "必去篩選沒有任何結果");
assert(mustGoPlaces.every((place) => place.mustGo === true), "必去篩選包含未標記的店家");
windowObject.location.search = "";
windowObject.SeoulGuide.state.mustGo = false;

console.log(
  `前端檢查通過：${localReferences.length} 個資源、${expectedScripts.length} 個腳本、${placeIds.length} 間店家`
);
