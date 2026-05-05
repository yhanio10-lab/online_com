export function mount(root, { api, toast, escapeHtml }) {
  let currentDetails = [];
  let currentDetailTitle = "상세내역";

  root.innerHTML = `
    <section class="kpis" aria-label="매출/수익 KPI">
      <div class="kpi"><span>매출액</span><strong data-kpi="sales">0</strong></div>
      <div class="kpi"><span>원가</span><strong data-kpi="cost">0</strong></div>
      <div class="kpi"><span>플랫폼 수수료</span><strong data-kpi="fee">0</strong></div>
      <div class="kpi"><span>수익금액</span><strong data-kpi="profit">0</strong></div>
      <div class="kpi"><span>수익률</span><strong data-kpi="profit-rate">0%</strong></div>
    </section>
    <section class="filters">
      <input data-role="file-path" placeholder="플레이오토 매출 .xls 또는 .csv 경로" />
      <button data-action="import-playauto">플레이오토 가져오기</button>
      <select data-role="group-by" aria-label="집계 기준">
        <option value="platform">플랫폼별</option>
        <option value="sku">SKU별</option>
      </select>
      <button data-action="refresh">조회</button>
    </section>
    <section class="split">
      <div>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>구분</th>
                <th>건수</th>
                <th>수량</th>
                <th>매출액</th>
                <th>원가</th>
                <th>수수료</th>
                <th>수익금액</th>
                <th>수익률</th>
              </tr>
            </thead>
            <tbody data-role="summary-rows"></tbody>
          </table>
        </div>
        <section class="panel" style="margin-top: 14px;">
          <h2>플랫폼 수수료</h2>
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>플랫폼</th>
                  <th>수수료율(%)</th>
                </tr>
              </thead>
              <tbody data-role="fee-rows"></tbody>
            </table>
          </div>
          <div class="toolbar" style="margin-top: 10px;">
            <button data-action="save-fees">수수료 저장</button>
          </div>
        </section>
      </div>
      <aside class="panel">
        <h2>최근 임포트</h2>
        <div data-role="import-list" class="muted"></div>
        <h2 style="margin-top: 18px;">매핑 실패</h2>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>플랫폼</th>
                <th>상품코드</th>
                <th>상품명</th>
                <th>옵션</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody data-role="failure-rows"></tbody>
          </table>
        </div>
      </aside>
    </section>
    <section class="panel detail-panel">
      <div class="detail-header">
        <div>
          <h2>상세내역</h2>
          <div data-role="detail-title" class="muted">수익률을 클릭하면 전체 상세내역이 표시됩니다.</div>
        </div>
        <button data-action="download-details">엑셀 다운로드</button>
      </div>
      <div class="table-shell detail-table-shell">
        <table>
          <thead>
            <tr>
              <th>일자</th>
              <th>플랫폼</th>
              <th>주문번호</th>
              <th>상품코드</th>
              <th>상품명</th>
              <th>옵션</th>
              <th>SKU</th>
              <th>수량</th>
              <th>매출액</th>
              <th>원가</th>
              <th>수수료</th>
              <th>수익</th>
              <th>수익률</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody data-role="detail-rows">
            <tr><td colspan="14" class="muted">선택된 항목이 없습니다.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  const $ = (selector) => root.querySelector(selector);

  function money(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function percent(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
  }

  function renderKpis(rows) {
    const total = rows.reduce(
      (sum, row) => ({
        amount: sum.amount + Number(row.amount || 0),
        cost: sum.cost + Number(row.cost_amount || 0),
        fee: sum.fee + Number(row.platform_fee_amount || 0),
        profit: sum.profit + Number(row.profit_amount || 0)
      }),
      { amount: 0, cost: 0, fee: 0, profit: 0 }
    );
    $('[data-kpi="sales"]').textContent = money(total.amount);
    $('[data-kpi="cost"]').textContent = money(total.cost);
    $('[data-kpi="fee"]').textContent = money(total.fee);
    $('[data-kpi="profit"]').textContent = money(total.profit);
    $('[data-kpi="profit-rate"]').textContent = percent(total.amount ? total.profit / total.amount : 0);
  }

  function renderSummary(rows) {
    $('[data-role="summary-rows"]').innerHTML = rows
      .map(
        (row) => `
          <tr data-summary-key="${escapeHtml(row.key)}">
            <td>${escapeHtml(row.key)}</td>
            <td>${row.item_count}</td>
            <td>${row.quantity}</td>
            <td>${money(row.amount)}</td>
            <td>${money(row.cost_amount)}</td>
            <td>${money(row.platform_fee_amount)}</td>
            <td>${money(row.profit_amount)}</td>
            <td><button type="button" data-action="show-details" data-key="${escapeHtml(row.key)}">${percent(row.profit_rate)}</button></td>
          </tr>
        `
      )
      .join("");
  }

  function renderFees(rows) {
    $('[data-role="fee-rows"]').innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.platform)}</td>
            <td>
              <input
                data-role="fee-rate"
                data-platform="${escapeHtml(row.platform)}"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value="${Number(row.fee_rate || 0) * 100}"
                aria-label="${escapeHtml(row.platform)} 수수료율"
              />
            </td>
          </tr>
        `
      )
      .join("");
  }

  function renderDetails(title, rows) {
    currentDetailTitle = title;
    currentDetails = rows;
    $('[data-role="detail-title"]').textContent = title;
    $('[data-role="detail-rows"]').innerHTML = rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.ordered_at)}</td>
                <td>${escapeHtml(row.platform)}</td>
                <td>${escapeHtml(row.order_id)}</td>
                <td>${escapeHtml(row.platform_product_id)}</td>
                <td>${escapeHtml(row.product_name)}</td>
                <td>${escapeHtml(row.option_name)}</td>
                <td>${escapeHtml(row.sku_code || "-")}</td>
                <td>${row.quantity}</td>
                <td>${money(row.amount)}</td>
                <td>${money(row.cost_amount)}</td>
                <td>${money(row.platform_fee_amount)}</td>
                <td>${money(row.profit_amount)}</td>
                <td>${percent(row.profit_rate)}</td>
                <td>${escapeHtml(row.mapping_status)}${row.mapping_reason ? ` / ${escapeHtml(row.mapping_reason)}` : ""}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="14" class="muted">상세내역이 없습니다.</td></tr>`;
  }

  function renderImports(rows) {
    $('[data-role="import-list"]').innerHTML = rows.length
      ? rows
          .slice(0, 5)
          .map(
            (row) =>
              `<p>${escapeHtml(row.imported_at)} / ${row.imported_rows}건 / 매핑 ${row.mapped_rows} / 실패 ${row.failed_rows} / 수익 ${money(row.profit_amount)}</p>`
          )
          .join("")
      : "임포트 이력이 없습니다.";
  }

  function renderFailures(rows) {
    $('[data-role="failure-rows"]').innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.platform)}</td>
            <td>${escapeHtml(row.platform_product_id)}</td>
            <td>${escapeHtml(row.product_name)}</td>
            <td>${escapeHtml(row.option_name)}</td>
            <td>${escapeHtml(row.mapping_reason)}</td>
          </tr>
        `
      )
      .join("");
  }

  async function refresh() {
    const groupBy = $('[data-role="group-by"]').value;
    const [summary, imports, failures, fees] = await Promise.all([
      api(`/api/sales/summary?groupBy=${encodeURIComponent(groupBy)}`),
      api("/api/sales/imports"),
      api("/api/sales/mapping-failures?limit=30"),
      api("/api/sales/platform-fees")
    ]);
    renderKpis(summary);
    renderSummary(summary);
    renderImports(imports);
    renderFailures(failures);
    renderFees(fees);
  }

  async function loadDetails(key) {
    const groupBy = $('[data-role="group-by"]').value;
    const rows = await api(`/api/sales/details?groupBy=${encodeURIComponent(groupBy)}&key=${encodeURIComponent(key)}&limit=0`);
    renderDetails(`${groupBy === "platform" ? "플랫폼" : "SKU"}: ${key} / ${rows.length}건`, rows);
    root.querySelector(".detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadDetails() {
    if (!currentDetails.length) {
      toast("다운로드할 상세내역이 없습니다.");
      return;
    }
    const headers = ["일자", "플랫폼", "주문번호", "상품코드", "상품명", "옵션", "SKU", "수량", "매출액", "원가", "수수료", "수익", "수익률", "상태"];
    const lines = [
      headers.map(csvCell).join(","),
      ...currentDetails.map((row) =>
        [
          row.ordered_at,
          row.platform,
          row.order_id,
          row.platform_product_id,
          row.product_name,
          row.option_name,
          row.sku_code || "",
          row.quantity,
          row.amount,
          row.cost_amount,
          row.platform_fee_amount,
          row.profit_amount,
          percent(row.profit_rate),
          `${row.mapping_status || ""}${row.mapping_reason ? ` / ${row.mapping_reason}` : ""}`
        ]
          .map(csvCell)
          .join(",")
      )
    ];
    const blob = new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentDetailTitle.replace(/[\\/:*?"<>|]/g, "_")}_상세내역.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function saveFees() {
    const fees = [...root.querySelectorAll('[data-role="fee-rate"]')].map((input) => ({
      platform: input.dataset.platform,
      fee_rate: Number(input.value || 0) / 100
    }));
    await api("/api/sales/platform-fees", {
      method: "PUT",
      body: JSON.stringify({ fees })
    });
    toast("플랫폼 수수료를 저장했습니다.");
    await refresh();
  }

  async function importPlayauto() {
    const filePath = $('[data-role="file-path"]').value.trim();
    if (!filePath) throw new Error("플레이오토 매출 파일 경로를 입력하세요.");
    const summary = await api("/api/sales/import/playauto", {
      method: "POST",
      body: JSON.stringify({ file_path: filePath })
    });
    toast(`플레이오토 임포트 완료: ${summary.imported_rows}건 / 매핑 ${summary.mapped_rows}건 / 실패 ${summary.failed_rows}건`);
    await refresh();
  }

  root.addEventListener("click", async (event) => {
    try {
      if (event.target.matches('[data-action="refresh"]')) await refresh();
      if (event.target.matches('[data-action="save-fees"]')) await saveFees();
      if (event.target.matches('[data-action="download-details"]')) downloadDetails();
      if (event.target.matches('[data-action="import-playauto"]')) await importPlayauto();
      if (event.target.matches('[data-action="show-details"]')) await loadDetails(event.target.dataset.key || "");
    } catch (error) {
      toast(error.message);
    }
  });

  return { refresh };
}
