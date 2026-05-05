export function mount(root, { api, toast, escapeHtml }) {
  const state = { selectedSkuCode: "" };

  root.innerHTML = `
    <section class="kpis" aria-label="세트/번들 KPI">
      <div class="kpi"><span>세트 SKU 수</span><strong data-kpi="bundle_count">0</strong></div>
      <div class="kpi"><span>구성 완료</span><strong data-kpi="configured">0</strong></div>
      <div class="kpi"><span>구성 미완료</span><strong data-kpi="incomplete">0</strong></div>
      <div class="kpi danger"><span>비활성 구성</span><strong data-kpi="inactive_components">0</strong></div>
    </section>
    <section class="filters">
      <input data-role="bundle-search" type="search" placeholder="세트 SKU 또는 품목명 검색" />
      <button data-action="search">검색</button>
    </section>
    <section class="split">
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>세트SKU</th>
              <th>세트명</th>
              <th>출고단가</th>
              <th>구성품수</th>
              <th>구성원가</th>
              <th>마진</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody data-role="bundle-rows"></tbody>
        </table>
      </div>
      <aside class="panel">
        <h2 data-role="detail-title">세트 SKU를 선택하세요</h2>
        <div data-role="detail-summary" class="muted"></div>
        <div class="inline-form">
          <input data-role="component-sku" placeholder="구성품 SKU" />
          <input data-role="component-qty" type="number" min="1" value="1" aria-label="구성 수량" />
          <button data-action="add-component">추가</button>
        </div>
        <div class="table-shell" style="margin-top: 12px;">
          <table>
            <thead>
              <tr>
                <th>구성품SKU</th>
                <th>구성품명</th>
                <th>수량</th>
                <th>원가</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody data-role="component-rows"></tbody>
          </table>
        </div>
      </aside>
    </section>
  `;

  const $ = (selector) => root.querySelector(selector);

  function money(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function renderKpis(kpis) {
    for (const [key, value] of Object.entries(kpis)) {
      const node = root.querySelector(`[data-kpi="${key}"]`);
      if (node) node.textContent = value;
    }
  }

  function renderBundles(items) {
    const tbody = $('[data-role="bundle-rows"]');
    tbody.innerHTML = "";
    for (const bundle of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(bundle.sku_code)}</td>
        <td>${escapeHtml(bundle.sku_name)}</td>
        <td>${money(bundle.sale_price)}</td>
        <td>${bundle.component_count}</td>
        <td>${money(bundle.component_cost)}</td>
        <td>${money(bundle.margin_amount)}</td>
        <td><button data-action="select-bundle" data-sku-code="${escapeHtml(bundle.sku_code)}">관리</button></td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderDetail(detail) {
    state.selectedSkuCode = detail.bundle.sku_code;
    $('[data-role="detail-title"]').textContent = `${detail.bundle.sku_code} 구성품`;
    $('[data-role="detail-summary"]').textContent = `${detail.bundle.sku_name} / 구성원가 ${money(detail.bundle.component_cost)} / 출고 ${money(detail.bundle.sale_price)}`;
    const tbody = $('[data-role="component-rows"]');
    tbody.innerHTML = "";
    for (const item of detail.components) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item.component_sku_code)}</td>
        <td>${escapeHtml(item.component?.sku_name || "")}</td>
        <td><input class="component-qty" type="number" min="1" value="${item.component_quantity}" data-component-id="${item.id}" /></td>
        <td>${money(Number(item.component?.purchase_price || 0) * item.component_quantity)}</td>
        <td>
          <button data-action="save-component" data-component-id="${item.id}">저장</button>
          <button data-action="delete-component" data-component-id="${item.id}">삭제</button>
        </td>
      `;
      if (!item.is_active) tr.className = "conflict-row";
      tbody.appendChild(tr);
    }
  }

  async function refresh() {
    const searchInput = $('[data-role="bundle-search"]');
    const params = new URLSearchParams({ q: searchInput?.value || "", page: "1", size: "50" });
    const data = await api(`/api/bundles?${params.toString()}`);
    renderKpis(data.kpis);
    renderBundles(data.items);
    if (state.selectedSkuCode) {
      try {
        renderDetail(await api(`/api/bundles/${encodeURIComponent(state.selectedSkuCode)}`));
      } catch {
        state.selectedSkuCode = "";
      }
    }
  }

  async function selectBundle(skuCode) {
    renderDetail(await api(`/api/bundles/${encodeURIComponent(skuCode)}`));
  }

  async function addComponent() {
    if (!state.selectedSkuCode) throw new Error("먼저 세트 SKU를 선택하세요.");
    const componentSkuInput = $('[data-role="component-sku"]');
    const componentQtyInput = $('[data-role="component-qty"]');
    const componentSkuCode = (componentSkuInput?.value || "").trim();
    const quantity = Number(componentQtyInput?.value || 1);
    const detail = await api(`/api/bundles/${encodeURIComponent(state.selectedSkuCode)}/components`, {
      method: "POST",
      body: JSON.stringify({ component_sku_code: componentSkuCode, component_quantity: quantity })
    });
    if (componentSkuInput) componentSkuInput.value = "";
    if (componentQtyInput) componentQtyInput.value = "1";
    renderDetail(detail);
    await refresh();
    toast("구성품을 저장했습니다.");
  }

  async function saveComponent(componentId) {
    const input = root.querySelector(`.component-qty[data-component-id="${componentId}"]`);
    if (!input) throw new Error("Component quantity input was not found");
    const detail = await api(`/api/bundles/${encodeURIComponent(state.selectedSkuCode)}/components/${componentId}`, {
      method: "PUT",
      body: JSON.stringify({ component_quantity: Number(input.value || 1), is_active: true })
    });
    renderDetail(detail);
    await refresh();
    toast("구성 수량을 저장했습니다.");
  }

  async function deleteComponent(componentId) {
    const detail = await api(`/api/bundles/${encodeURIComponent(state.selectedSkuCode)}/components/${componentId}`, { method: "DELETE" });
    renderDetail(detail);
    await refresh();
    toast("구성품을 비활성 처리했습니다.");
  }

  root.addEventListener("click", async (event) => {
    try {
      if (event.target.matches('[data-action="search"]')) await refresh();
      if (event.target.matches('[data-action="select-bundle"]')) await selectBundle(event.target.dataset.skuCode);
      if (event.target.matches('[data-action="add-component"]')) await addComponent();
      if (event.target.matches('[data-action="save-component"]')) await saveComponent(event.target.dataset.componentId);
      if (event.target.matches('[data-action="delete-component"]')) await deleteComponent(event.target.dataset.componentId);
    } catch (error) {
      toast(error.message);
    }
  });

  $('[data-role="bundle-search"]').addEventListener("keydown", (event) => {
    if (event.key === "Enter") refresh().catch((error) => toast(error.message));
  });

  return { refresh };
}
