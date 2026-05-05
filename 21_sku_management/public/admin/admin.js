const appState = {
  modules: [],
  current: null,
  currentApi: null
};

const $ = (selector) => document.querySelector(selector);

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    const error = payload.error || { message: "요청 실패" };
    throw new Error(`${error.code || "ERROR"}: ${error.message}`);
  }
  return payload.data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function activateModule(moduleMeta) {
  appState.current = moduleMeta;
  $("#moduleTitle").textContent = moduleMeta.label;
  $("#moduleDescription").textContent = moduleMeta.description || "";
  document.querySelectorAll(".module-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.moduleId === moduleMeta.id);
  });
  const root = $("#moduleRoot");
  root.innerHTML = "";
  const loaded = await import(moduleMeta.module);
  appState.currentApi = loaded.mount(root, { api, toast, escapeHtml });
  if (appState.currentApi?.refresh) await appState.currentApi.refresh();
  window.location.hash = moduleMeta.id;
}

function renderNav() {
  const nav = $("#moduleNav");
  nav.innerHTML = "";
  for (const moduleMeta of appState.modules) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.moduleId = moduleMeta.id;
    button.textContent = moduleMeta.label;
    button.addEventListener("click", () => activateModule(moduleMeta).catch((error) => toast(error.message)));
    nav.appendChild(button);
  }
}

async function init() {
  appState.modules = await fetch("/admin/modules/manifest.json").then((response) => response.json());
  renderNav();
  const id = window.location.hash.replace("#", "");
  const initial = appState.modules.find((item) => item.id === id) || appState.modules[0];
  if (initial) await activateModule(initial);
}

$("#reloadModuleBtn").addEventListener("click", () => {
  appState.currentApi?.refresh?.().catch((error) => toast(error.message));
});

init().catch((error) => toast(error.message));
