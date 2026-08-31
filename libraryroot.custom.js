const NAV    = "._2D64jIEK7wpUR_NlObDW76";
const ITEM   = "._2Lu3d-5qLmW4i19ysTt2jT._7AlhCx3XGzBeIrQaCneUD";
const LABEL  = "._19axKcqYRuaJ8vdYKYmtTQ";
const ACTIVE = "_1gqEjB5QsKT_NftD1dEsdZ";

const enabled = () => !!document.querySelector('link[href*="nav_tabs.css"]');

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
    if (!enabled()) return;

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

build();
new MutationObserver(build).observe(document.body, { childList: true, subtree: true });

document.addEventListener("click", e => {
    if (!e.target.closest("[data-custom-nav]")) {
        document.body.removeAttribute("data-custom-nav-active");
        document.querySelectorAll("[data-custom-nav]")
        .forEach(n => n.classList.remove(ACTIVE));
    }
}, true);

console.log("[redageddon] theme js loaded");
