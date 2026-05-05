export function mount(root, { api, toast, escapeHtml }) {
  const state = { activeSkuInput: null, searchTimer: null };

  root.innerHTML = `
    <section class="kpis" aria-label="SKU 매핑 KPI">
      <div class="kpi"><span>총 옵션수</span><strong data-kpi="total">0</strong></div>
      <div class="kpi"><span>매핑완료</span><strong data-kpi="mapped">0</strong></div>
      <div class="kpi"><span>미매핑</span><strong data-kpi="unmapped">0</strong></div>
      <div class="kpi danger"><span>충돌</span><strong data-kpi="conflicts">0</strong></div>
    </section>
    <section class="filters">
      <select data-filter="platform" aria-label="플랫폼">
        <option value="">전체 플랫폼</option>
        <option value="smartstore">smartstore</option>
        <option value="openmarket">openmarket</option>
      </select>
      <select data-filter="status" aria-label="상태">
        <option value="">전체 상태</option>
        <option value="mapped">매핑완료</option>
        <option value="unmapped">미매핑</option>
        <option value="conflict">충돌</option>
      </select>
      <input data-filter="q" type="search" placeholder="상품번호, 상품명, 옵션명, 옵션ID, SKU 검색" />
      <button data-action="search">검색</button>
      <button data-action="bulk-map">선택 일괄 매핑</button>
    </section>
    <section class="table-shell">
      <table>
        <thead>
          <tr>
            <th><input data-action="select-all" type="checkbox" /></th>
            <th>플랫폼</th>
            <th>플랫폼 상품번호</th>
            <th>상품명</th>
            <th>옵션명</th>
            <th>옵션ID</th>
            <th>현재SKU</th>
            <th>추천SKU</th>
            <th>상태</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody data-role="rows"></tbody>
      </table>
    </section>
    <dialog data-role="sku-dialog">
      <form method="dialog" class="dialog">
        <header>
          <h2>SKU 검색</h2>
          <button value="close" title="닫기">×</button>
        </header>
        <input data-role="sku-dialog-search" type="search" placeholder="SKU 코드 또는 이름" />
        <div data-role="sku-result-count" class="sku-result-count"></div>
        <div data-role="sku-results" class="sku-results"></div>
      </form>
    </dialog>
  `;

  const $ = (selector) => root.querySelector(selector);

  function statusLabel(status) {
    return { mapped: "매핑완료", unmapped: "미매핑", conflict: "충돌" }[status] || status;
  }

  function renderKpis(kpis) {
    $('[data-kpi="total"]').textContent = kpis.total_options;
    $('[data-kpi="mapped"]').textContent = kpis.mapped;
    $('[data-kpi="unmapped"]').textContent = kpis.unmapped;
    $('[data-kpi="conflicts"]').textContent = kpis.conflicts;
  }

  function renderRows(rows) {
    const tbody = $('[data-role="rows"]');
    tbody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      if (row.mapping_status === "conflict") tr.className = "conflict-row";
      tr.innerHTML = `
        <td><input class="row-check" type="checkbox" data-option-id="${row.id}" data-platform="${escapeHtml(row.platform)}"></td>
        <td>${escapeHtml(row.platform)}</td>
        <td>${escapeHtml(row.platform_product_id)}</td>
        <td>${escapeHtml(row.product_name)}</td>
        <td>${escapeHtml(row.option_name)}</td>
        <td>${escapeHtml(row.option_id)}</td>
        <td>
          <div class="sku-cell">
            <input class="sku-input" value="${escapeHtml(row.current_sku_code || "")}" placeholder="SKU 코드" data-mapping-id="${row.current_mapping_id || ""}" data-option-id="${row.id}" data-platform="${escapeHtml(row.platform)}">
            <button class="sku-search-btn" title="SKU 검색">⌕</button>
          </div>
        </td>
        <td>${escapeHtml(row.recommended_sku_code || "")}</td>
        <td><span class="status ${escapeHtml(row.mapping_status)}" title="${escapeHtml(row.conflict_reasons.join("\n"))}">${statusLabel(row.mapping_status)}</span></td>
        <td><button class="save-btn">저장</button></td>
      `;
      tbody.appendChild(tr);
    }
  }

  async function refresh() {
    const params = new URLSearchParams({
      platform: $('[data-filter="platform"]').value,
      status: $('[data-filter="status"]').value,
      q: $('[data-filter="q"]').value,
      page: "1",
      size: "50"
    });
    const data = await api(`/api/mapping/options?${params.toString()}`);
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
    await refresh();
  }

  async function renderSkuResults(q) {
    const results = await api(`/api/sku/search?q=${encodeURIComponent(q || "")}&size=200`);
    const box = $('[data-role="sku-results"]');
    box.innerHTML = "";
    $('[data-role="sku-result-count"]').textContent = `검색 결과 ${results.length}개${results.length >= 200 ? " 이상, 검색어를 더 좁혀주세요" : ""}`;
    for (const sku of results) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sku-result";
      const setLabel = sku.is_set ? " / 세트" : "";
      button.innerHTML = `<strong>${escapeHtml(sku.sku_code)}</strong><span>${escapeHtml(sku.sku_name)}${setLabel} / 입고 ${sku.purchase_price || 0} / 출고 ${sku.sale_price || 0}</span>`;
      button.addEventListener("click", () => {
        if (state.activeSkuInput) state.activeSkuInput.value = sku.sku_code;
        $('[data-role="sku-dialog"]').close();
      });
      box.appendChild(button);
    }
  }

  async function openSkuDialog(input) {
    state.activeSkuInput = input;
    $('[data-role="sku-dialog-search"]').value = input.value;
    await renderSkuResults(input.value);
    $('[data-role="sku-dialog"]').showModal();
    $('[data-role="sku-dialog-search"]').focus();
  }

  async function bulkMap() {
    const checked = Array.from(root.querySelectorAll(".row-check:checked"));
    const items = checked.map((checkbox) => getRowPayload(checkbox.closest("tr").querySelector(".sku-input")));
    if (!items.length) throw new Error("선택된 옵션이 없습니다.");
    const data = await api("/api/mapping/bulk", { method: "POST", body: JSON.stringify({ created_by: "admin-ui", items }) });
    toast(`일괄 매핑 완료: ${data.success}/${data.total}`);
    await refresh();
  }

  root.addEventListener("click", async (event) => {
    try {
      if (event.target.matches('[data-action="search"]')) await refresh();
      if (event.target.matches(".save-btn")) await saveInput(event.target.closest("tr").querySelector(".sku-input"));
      if (event.target.matches(".sku-search-btn")) await openSkuDialog(event.target.closest("tr").querySelector(".sku-input"));
      if (event.target.matches('[data-action="bulk-map"]')) await bulkMap();
    } catch (error) {
      toast(error.message);
    }
  });

  $('[data-action="select-all"]').addEventListener("change", (event) => {
    root.querySelectorAll(".row-check").forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
  });

  $('[data-role="sku-dialog-search"]').addEventListener("input", (event) => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => renderSkuResults(event.target.value).catch((error) => toast(error.message)), 180);
  });

  $('[data-filter="q"]').addEventListener("keydown", (event) => {
    if (event.key === "Enter") refresh().catch((error) => toast(error.message));
  });

  return { refresh };
}
