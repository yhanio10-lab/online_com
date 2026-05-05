const state = {
  rows: [],
  activeSkuInput: null
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

function statusLabel(status) {
  return { mapped: "매핑완료", unmapped: "미매핑", conflict: "충돌" }[status] || status;
}

function renderKpis(kpis) {
  $("#kpiTotal").textContent = kpis.total_options;
  $("#kpiMapped").textContent = kpis.mapped;
  $("#kpiUnmapped").textContent = kpis.unmapped;
  $("#kpiConflicts").textContent = kpis.conflicts;
}

function renderRows(rows) {
  const tbody = $("#optionRows");
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.mapping_status === "conflict") tr.className = "conflict-row";
    tr.innerHTML = `
      <td><input class="row-check" type="checkbox" data-option-id="${row.id}" data-platform="${row.platform}"></td>
      <td>${row.platform}</td>
      <td>${row.product_name}</td>
      <td>${row.option_name}</td>
      <td>${row.option_id}</td>
      <td>
        <div class="sku-cell">
          <input class="sku-input" value="${row.current_sku_code || ""}" placeholder="SKU 코드" data-mapping-id="${row.current_mapping_id || ""}" data-option-id="${row.id}" data-platform="${row.platform}">
          <button class="sku-search-btn" title="SKU 검색">⌕</button>
        </div>
      </td>
      <td>${row.recommended_sku_code || ""}</td>
      <td><span class="status ${row.mapping_status}" title="${row.conflict_reasons.join("\n")}">${statusLabel(row.mapping_status)}</span></td>
      <td><button class="save-btn">저장</button></td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadOptions() {
  const params = new URLSearchParams({
    platform: $("#platformFilter").value,
    status: $("#statusFilter").value,
    q: $("#searchInput").value,
    page: "1",
    size: "50"
  });
  const data = await api(`/api/mapping/options?${params.toString()}`);
  state.rows = data.items;
  renderKpis(data.kpis);
  renderRows(data.items);
}

function getRowPayload(input) {
  const skuCode = input.value.trim();
  if (!skuCode) throw new Error("SKU 코드를 입력하세요.");
  return {
    platform: input.dataset.platform,
    product_option_id: Number(input.dataset.optionId),
    sku_code: skuCode,
    created_by: "admin-ui",
    changed_by: "admin-ui",
    reason: "admin-ui"
  };
}

async function saveInput(input) {
  const payload = getRowPayload(input);
  if (input.dataset.mappingId) {
    await api(`/api/mapping/${input.dataset.mappingId}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await api("/api/mapping", { method: "POST", body: JSON.stringify(payload) });
  }
  toast("매핑을 저장했습니다.");
  await loadOptions();
}

async function openSkuDialog(input) {
  state.activeSkuInput = input;
  $("#skuDialogSearch").value = input.value;
  await renderSkuResults(input.value);
  $("#skuDialog").showModal();
  $("#skuDialogSearch").focus();
}

async function renderSkuResults(q) {
  const results = await api(`/api/sku/search?q=${encodeURIComponent(q || "")}`);
  const box = $("#skuResults");
  box.innerHTML = "";
  for (const sku of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sku-result";
    button.innerHTML = `<strong>${sku.sku_code}</strong><span>${sku.sku_name}</span>`;
    button.addEventListener("click", () => {
      if (state.activeSkuInput) state.activeSkuInput.value = sku.sku_code;
      $("#skuDialog").close();
    });
    box.appendChild(button);
  }
}

async function bulkMap() {
  const checked = Array.from(document.querySelectorAll(".row-check:checked"));
  const items = checked.map((checkbox) => {
    const input = checkbox.closest("tr").querySelector(".sku-input");
    return getRowPayload(input);
  });
  if (!items.length) throw new Error("선택된 옵션이 없습니다.");
  const data = await api("/api/mapping/bulk", {
    method: "POST",
    body: JSON.stringify({ created_by: "admin-ui", items })
  });
  toast(`일괄 매핑 완료: ${data.success}/${data.total}`);
  await loadOptions();
}

document.addEventListener("click", async (event) => {
  try {
    if (event.target.matches("#searchBtn, #refreshBtn")) await loadOptions();
    if (event.target.matches(".save-btn")) await saveInput(event.target.closest("tr").querySelector(".sku-input"));
    if (event.target.matches(".sku-search-btn")) await openSkuDialog(event.target.closest("tr").querySelector(".sku-input"));
    if (event.target.matches("#bulkMapBtn")) await bulkMap();
  } catch (error) {
    toast(error.message);
  }
});

$("#selectAll").addEventListener("change", (event) => {
  document.querySelectorAll(".row-check").forEach((checkbox) => {
    checkbox.checked = event.target.checked;
  });
});

$("#skuDialogSearch").addEventListener("input", (event) => {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => renderSkuResults(event.target.value).catch((error) => toast(error.message)), 180);
});

$("#searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadOptions().catch((error) => toast(error.message));
});

loadOptions().catch((error) => toast(error.message));
