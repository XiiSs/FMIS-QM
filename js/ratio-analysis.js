// Historical figures transcribed from Section IV of the Swift Foods proposal.
window.renderRatioAnalysis = function (host) {
  const periods = ["2014", "2015", "2016", "FY2023", "FY2024", "FY2025", "Sep. 30, 2026"];
  const rows = [
    ["Liquidity", "Current ratio", "Current assets ÷ current liabilities", "0.65|0.61|0.57|0.49|0.31|0.27|0.18"],
    ["Liquidity", "Cash ratio", "Cash ÷ current liabilities", "0.56|0.50|0.46|0.31|0.18|0.16|—"],
    ["Liquidity", "Working capital (₱M)", "Current assets − current liabilities", "(24.2)|(27.2)|(30.6)|(27.5)|(34.0)|(39.6)|(45.3)"],
    ["Leverage", "Debt ratio", "Total liabilities ÷ total assets", "68.5%|64.2%|65.0%|35.5%|34.0%|35.2%|35.6%"],
    ["Leverage", "Debt-to-equity", "Total liabilities ÷ equity", "2.18|1.79|1.86|0.55|0.52|0.54|0.55"],
    ["Leverage", "Equity ratio", "Equity ÷ total assets", "31.5%|35.8%|35.0%|64.5%|66.0%|64.8%|64.4%"],
    ["Profitability", "Gross margin", "Gross income ÷ net sales", "0.9%|11.5%|10.3%|5.7%|3.7%|7.9%|—"],
    ["Profitability", "Operating margin", "Operating result ÷ net sales", "(12.1%)|(8.1%)|(9.9%)|(22.1%)|(35.3%)|(42.0%)|—"],
    ["Profitability", "Net margin", "Net income ÷ net sales", "(10.0%)|(8.5%)|(2.0%)|184.2%|119.8%|(27.5%)|(55.8%)"],
    ["Profitability", "Return on assets", "Net income ÷ total assets", "(4.1%)|(2.1%)|(0.5%)|19.8%|8.7%|(1.4%)|—"],
    ["Profitability", "Return on equity", "Net income ÷ equity", "(13.0%)|(6.0%)|(1.4%)|30.6%|13.1%|(2.2%)|—"],
    ["Profitability", "Operating return on assets", "Operating result ÷ total assets", "(4.9%)|(2.0%)|(2.3%)|(2.4%)|(2.6%)|(2.2%)|—"],
    ["Efficiency", "Asset turnover", "Net sales ÷ total assets", "0.41|0.25|0.24|0.11|0.07|0.05|—"],
    ["Cash flow", "Operating cash flow / sales", "Operating cash flow ÷ net sales", "(6.0%)|(8.3%)|(5.4%)|8.0%|(18.5%)|(0.1%)|—"],
  ];
  const categories = [...new Set(rows.map(([category]) => category))];
  host.innerHTML = `
    <section class="report-section">
      <h3 class="report-section-title">Historical Financial Ratio Analysis</h3>
      <p>Source: Swift Foods FMIS proposal, Section IV. Parentheses indicate negative values and dashes indicate unavailable figures. September 2026 net margin covers nine months.</p>
      <div class="report-summary-grid">
        <div class="dashboard-panel"><strong>0.18</strong><p>Current ratio · Sep. 30, 2026</p></div>
        <div class="dashboard-panel"><strong>(₱45.3M)</strong><p>Working capital · Sep. 30, 2026</p></div>
        <div class="dashboard-panel"><strong>(42.0%)</strong><p>Operating margin · FY2025</p></div>
        <div class="dashboard-panel"><strong>0.05</strong><p>Asset turnover · FY2025</p></div>
      </div>
      <label>Ratio category <select data-ratio-category>
        <option value="">All ratios</option>
        ${categories.map((category) => `<option>${category}</option>`).join("")}
      </select></label>
      <label>Comparison period <select data-ratio-range>
        <option value="all">2014–September 2026</option>
        <option value="recent">FY2023–September 2026</option>
        <option value="early">2014–2016</option>
      </select></label>
      <div class="report-table-panel" style="overflow-x:auto">
        <table class="report-table">
          <caption>Ratio trend by reporting period</caption>
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>`;
  const categorySelect = host.querySelector("[data-ratio-category]");
  const rangeSelect = host.querySelector("[data-ratio-range]");
  function renderRows() {
    const start = rangeSelect.value === "recent" ? 3 : 0;
    const end = rangeSelect.value === "early" ? 3 : periods.length;
    host.querySelector("thead").innerHTML = `<tr><th scope="col">Indicator and formula</th>
      ${periods.slice(start, end).map((period) => `<th scope="col">${period}</th>`).join("")}</tr>`;
    host.querySelector("tbody").innerHTML = rows
      .filter(([category]) => !categorySelect.value || category === categorySelect.value)
      .map(([, name, formula, values]) => `<tr><th scope="row">${name}<br><small>${formula}</small></th>
        ${values.split("|").slice(start, end).map((value) => `<td>${value}</td>`).join("")}</tr>`)
      .join("");
  }
  categorySelect.addEventListener("change", renderRows);
  rangeSelect.addEventListener("change", renderRows);
  renderRows();
};