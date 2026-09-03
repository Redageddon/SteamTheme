/* ==========================================================================
 r edageddon theme — libraryroot.custom.js *
 ========================================================================== */

/* ── Custom navigation tabs ─────────────────────────────────────────────── */

const NAV    = "._2D64jIEK7wpUR_NlObDW76";
const ITEM   = "._2Lu3d-5qLmW4i19ysTt2jT._7AlhCx3XGzBeIrQaCneUD";
const LABEL  = "._19axKcqYRuaJ8vdYKYmtTQ";
const ACTIVE = "_1gqEjB5QsKT_NftD1dEsdZ";

const navEnabled = () => !!document.querySelector('link[href*="nav_tabs.css"]');

function make(template, text, url) {
    const node = template.cloneNode(true);
    node.removeAttribute("data-nav-store");
    node.removeAttribute("data-nav-hidden");
    node.classList.remove(ACTIVE);
    node.querySelector(LABEL).textContent = text;
    node.setAttribute("data-custom-nav", "");
    node.addEventListener("click", e => {
        e.stopPropagation();
        [...document.querySelectorAll(ITEM)].forEach(i => i.classList.remove(ACTIVE));
        node.classList.add(ACTIVE);
        document.body.setAttribute("data-custom-nav-active", "");
        node.blur();
        window.open(url);
    });
    return node;
}

function build() {
    if (!navEnabled()) return;

    const nav = document.querySelector(NAV);
    if (!nav) return;

    const items = [...nav.querySelectorAll(ITEM)];
    const find = t => items.find(i => i.textContent.trim().toUpperCase() === t);

    const community = find("COMMUNITY");
    if (community) community.setAttribute("data-nav-hidden", "");

    if (nav.querySelector("[data-custom-nav]")) return;

    const store = find("STORE");
    if (!store || !community) return;
    store.setAttribute("data-nav-store", "");

    store.after(make(store, "POINTS SHOP", "https://store.steampowered.com/points/shop/"));
    community.after(make(store, "MARKET",   "https://steamcommunity.com/market/"));
    community.after(make(store, "WORKSHOP", "https://steamcommunity.com/workshop/"));
}

document.addEventListener("click", e => {
    if (!e.target.closest("[data-custom-nav]")) {
        document.body.removeAttribute("data-custom-nav-active");
        document.querySelectorAll("[data-custom-nav]")
        .forEach(n => n.classList.remove(ACTIVE));
    }
}, true);


/* ── Wide covers ────────────────────────────────────────────────────────── */
/*
 S waps the portrait library art (library_6*00x900.jpg / library_capsule.jpg)
 for the horizontal header art on shelf tiles.

     Not a toggle of its own — it rides on Games-Per-Column. Picking "6 (Wide)"
     loads config/gridSize/6_wide.css, which is what this checks for; any other
     column count leaves the portrait art alone.

     Scoped to `.DGRkX_HYUzbFaqRysWQVi [role="gridcell"]` — the collection /
     favorites shelf grid only. The Recents shelf is deliberately untouched.

     Steam serves cached art under a virtual `/assets/<appid>/...` path. Note
     that some apps have a per-asset content hash in the path
     (`/assets/381210/<hash>/library_capsule.jpg`) and each asset type has its
     OWN hash, so the filename cannot simply be swapped in place — we always
     probe the unhashed path first and fall back to the public CDN.
     */

const GRID_IMG   = '.DGRkX_HYUzbFaqRysWQVi [role="gridcell"] img';
const ASSET_RE   = /^\/assets\/(\d+)\//;
const CDN        = "https://cdn.cloudflare.steamstatic.com/steam/apps";
const STORE_API  = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
const STORE_CDN  = "https://shared.cloudflare.steamstatic.com/store_item_assets/";

const wideEnabled = () => !!document.querySelector('link[href*="6_wide.css"]');

const wideCache   = new Map();      // appid -> Promise<string|null>
const wideApplied = new WeakMap();  // img   -> url we set on it

/* Probe via <img> rather than fetch(): works for the local /assets/ path AND
 f or the CDN (which sends no CORS header, *so fetch would throw). Requiring
 width > height also rejects the case where Steam falls back to portrait. */
function probe(url) {
    return new Promise(resolve => {
        const im = new Image();
        im.onload  = () => resolve(im.naturalWidth > im.naturalHeight);
        im.onerror = () => resolve(false);
        im.src = url;
    });
}

async function firstThatLoads(urls) {
    for (const url of urls) {
        if (await probe(url)) return url;
    }
    return null;
}

/* ── Hashed-asset lookup ────────────────────────────────────────────────────
 N ewer apps store every asset behind its O*WN content hash, and the header's
 hash is unrelated to the library_capsule's — so it cannot be derived from
 the src we already have, it has to be looked up. GetItems returns it, and
 it accepts many appids per call, so misses are batched into one request.

 Note the local cache normalises the filename: the store may call the file
 header_alt_assets_1.jpg while Steam caches it as library_header.jpg, so we
 try the cache name first and the store name second.                        */

let batchQueue = [];
let batchTimer = null;

function queueStoreLookup(appid) {
    return new Promise(resolve => {
        batchQueue.push({ appid, resolve });
        clearTimeout(batchTimer);
        if (batchQueue.length >= 50) flushBatch();
        else batchTimer = setTimeout(flushBatch, 100);
    });
}

async function flushBatch() {
    const batch = batchQueue;
    batchQueue = [];
    clearTimeout(batchTimer);
    batchTimer = null;
    if (!batch.length) return;

    let items = [];
    try {
        const input = encodeURIComponent(JSON.stringify({
            ids: batch.map(b => ({ appid: Number(b.appid) })),
                                                        context: { country_code: "US", language: "english" },
                                                        data_request: { include_assets: true },
        }));
        const res = await fetch(`${STORE_API}?input_json=${input}`);
        items = (await res.json())?.response?.store_items ?? [];
    } catch (e) {
        /* offline or rate limited — these tiles keep their portrait art */
    }

    const assetsFor = new Map(items.map(i => [String(i.appid), i.assets]));

    for (const { appid, resolve } of batch) {
        const assets = assetsFor.get(String(appid));
        if (!assets?.header) { resolve(null); continue; }

        const [hash, file] = assets.header.split("/");
        const candidates = [
            `/assets/${appid}/${hash}/library_header.jpg`,
            `/assets/${appid}/${hash}/${file}`,
        ];
        if (assets.asset_url_format) {
            candidates.push(
                STORE_CDN + assets.asset_url_format.replace("${FILENAME}", assets.header)
            );
        }
        resolve(await firstThatLoads(candidates));
    }
}

function resolveWide(appid) {
    if (!wideCache.has(appid)) {
        wideCache.set(appid, (async () => {
            /* Legacy apps: unhashed paths, no lookup needed. */
            const easy = await firstThatLoads([
                `/assets/${appid}/header.jpg`,
                `/assets/${appid}/library_header.jpg`,
                `${CDN}/${appid}/header.jpg`,
            ]);
            if (easy) return easy;

            /* Hashed apps: ask the store where the header actually lives. */
            return queueStoreLookup(appid);
        })());
    }
    return wideCache.get(appid);
}

async function applyWide(img, appid) {
    const url = await resolveWide(appid);
    if (!url || !img.isConnected || !wideEnabled()) return;
    wideApplied.set(img, url);
    img.setAttribute("data-wide-cover", "");
    img.setAttribute("src", url);
}

function wideScan() {
    const on = wideEnabled();

    document.querySelectorAll(GRID_IMG).forEach(img => {
        const src = img.getAttribute("src") || "";

        /* Toggle turned off — put the original art back. */
        if (!on) {
            if (img.dataset.wideOrig && src !== img.dataset.wideOrig) {
                img.removeAttribute("data-wide-cover");
                img.setAttribute("src", img.dataset.wideOrig);
                wideApplied.delete(img);
            }
            return;
        }

        /* Already ours — React hasn't clobbered it. */
        if (wideApplied.get(img) === src) return;

        const m = src.match(ASSET_RE);
        if (!m) return;

        img.dataset.wideOrig = src;
        applyWide(img, m[1]);
    });
}


/* ── Shared observer ────────────────────────────────────────────────────── */

let queued = false;
function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        build();
        wideScan();
    });
}

schedule();

new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],   // React re-renders reset src; catch that
});

console.log("[redageddon] theme js loaded");
