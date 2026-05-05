export function mount(root, { api, toast, escapeHtml }) {
  root.innerHTML = `
    <section class="kpis" aria-label="매출/수익 KPI">
      <div class="kpi"><span>매출액</span><strong data-kpi="sales">0</strong></div>
      <div class="kpi"><span>원가</span><strong data-kpi="cost">0</strong></div>
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
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>건수</th>
              <th>수량</th>
              <th>매출액</th>
              <th>원가</th>
              <th>수익금액</th>
              <th>수익률</th>
            </tr>
          </thead>
          <tbody data-role="summary-rows"></tbody>
        </table>
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
        profit: sum.profit + Number(row.profit_amount || 0)
      }),
      { amount: 0, cost: 0, profit: 0 }
    );
    $('[data-kpi="sales"]').textContent = money(total.amount);
    $('[data-kpi="cost"]').textContent = money(total.cost);
    $('[data-kpi="profit"]').textContent = money(total.profit);
    $('[data-kpi="profit-rate"]').textContent = percent(total.amount ? total.profit / total.amount : 0);
  }

  function renderSummary(rows) {
    $('[data-role="summary-rows"]').innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.key)}</td>
            <td>${row.item_count}</td>
            <td>${row.quantity}</td>
            <td>${money(row.amount)}</td>
            <td>${money(row.cost_amount)}</td>
            <td>${money(row.profit_amount)}</td>
            <td>${percent(row.profit_rate)}</td>
          </tr>
        `
      )
      .join("");
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
    const [summary, imports, failures] = await Promise.all([
      api(`/api/sales/summary?groupBy=${encodeURIComponent(groupBy)}`),
      api("/api/sales/imports"),
      api("/api/sales/mapping-failures?limit=30")
    ]);
    renderKpis(summary);
    renderSummary(summary);
    renderImports(imports);
    renderFailures(failures);
  }

  async function importPlayauto() {
    const filePath = $('[data-role="file-path"]').value.trim();
    if (!filePath) throw new Error("플레이오토 매출 파일 경로를 입력하세요.");
    const summary = await api("/api/sales/import/playauto", {
      method: "POST",
      body: JSON.stringify({ file_path: filePath })
    });
    toast(`플레이오토 임포트 완료: ${summary.imported_rows}건, 매핑 ${summary.mapped_rows}건, 실패 ${summary.failed_rows}건`);
    await refresh();
  }

  root.addEventListener("click", async (event) => {
    try {
      if (event.target.matches('[data-action="refresh"]')) await refresh();
      if (event.target.matches('[data-action="import-playauto"]')) await importPlayauto();
    } catch (error) {
      toast(error.message);
    }
  });

  return { refresh };
}
