/**
 * FMIS-QM Frame 9: Financial Reports Controller
 * Consolidates real transaction records from FMIS Core Engine.
 */
(function () {
  "use strict";

  function initReports() {
    let session;
    try {
      session = JSON.parse(sessionStorage.getItem("fmisSession"));
    } catch {
      sessionStorage.removeItem("fmisSession");
    }

    if (
      !session ||
      typeof session.email !== "string" ||
      typeof session.role !== "string" ||
      !Array.isArray(session.permissions) ||
      !session.permissions.includes("reports")
    ) {
      window.location.replace("login.html");
      return;
    }

    const permissions = new Set(session.permissions);
    const fullName = window.FMIS.getDisplayName(session);
    const initials = window.FMIS.getInitials(fullName);

    // Profile & RBAC UI
    const profileNameEl = document.querySelector("#profile-name");
    const profileRoleEl = document.querySelector("#profile-role");
    const sidebarUserEl = document.querySelector("#sidebar-user-name");

    if (profileNameEl) profileNameEl.textContent = fullName;
    if (profileRoleEl) profileRoleEl.textContent = session.role;
    if (sidebarUserEl) sidebarUserEl.textContent = session.role;
    document.querySelectorAll(".user-avatar").forEach((avatar) => {
      avatar.textContent = initials;
    });

    document.querySelectorAll("[data-permission]").forEach((element) => {
      if (permissions.has(element.dataset.permission)) return;
      if (element.classList.contains("nav-link")) {
        element.removeAttribute("href");
        element.setAttribute("aria-disabled", "true");
        element.setAttribute("tabindex", "-1");
        element.classList.add("is-unavailable");
      } else {
        element.hidden = true;
      }
    });

    // Mobile Sidebar toggle
    const sidebar = document.querySelector(".dashboard-sidebar");
    const menuToggle = document.querySelector("#menu-toggle");
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("is-open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          sidebar.classList.remove("is-open");
          menuToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // UI Controls
    const form = document.querySelector("#report-form");
    const periodSelect = document.querySelector("#report-period");
    const asOfInput = document.querySelector("#report-as-of");
    const typeSelect = document.querySelector("#report-type");
    const customRangeBar = document.querySelector("#reports-custom-range-bar");
    const startDateInput = document.querySelector("#reports-start-date");
    const endDateInput = document.querySelector("#reports-end-date");
    const feedback = document.querySelector("#report-feedback");

    const reportTitleEl = document.querySelector("#report-preview-title");
    const reportPeriodEl = document.querySelector("#report-preview-period");
    const reportGenTimeEl = document.querySelector("#report-preview-gentime");
    const reportAuthorEl = document.querySelector("#report-preview-author");
    const reportBodyEl = document.querySelector("#report-preview-body");

    let currentCategory = "summary";
    let activePeriod = window.FMIS.parsePeriod(periodSelect.value);

    // Period selector handler
    periodSelect.addEventListener("change", () => {
      if (periodSelect.value === "custom") {
        customRangeBar.hidden = false;
        activePeriod = window.FMIS.parsePeriod("custom", startDateInput.value, endDateInput.value);
      } else {
        customRangeBar.hidden = true;
        activePeriod = window.FMIS.parsePeriod(periodSelect.value);
      }
      if (asOfInput) asOfInput.value = activePeriod.end || "Oct 31, 2026";
      generateCurrentReport();
    });

    // Report Type / Category Dropdown Handler
    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        currentCategory = typeSelect.value;
        document.querySelectorAll(".report-cat-btn").forEach((b) => {
          const match = b.dataset.reportCat === currentCategory;
          b.classList.toggle("is-active", match);
          b.setAttribute("aria-selected", String(match));
        });
        generateCurrentReport();
      });
    }

    // Category Buttons Tablist
    document.querySelectorAll(".report-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".report-cat-btn").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        currentCategory = btn.dataset.reportCat;
        if (typeSelect) typeSelect.value = currentCategory;
        generateCurrentReport();
      });
    });

    // Generate Form Submit
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (periodSelect.value === "custom") {
        activePeriod = window.FMIS.parsePeriod("custom", startDateInput.value, endDateInput.value);
      } else {
        activePeriod = window.FMIS.parsePeriod(periodSelect.value);
      }
      generateCurrentReport();
      showFeedback(`Report successfully generated for ${activePeriod.label}.`);
    });

    // Print & Export PDF buttons
    document.querySelector("#report-print")?.addEventListener("click", () => window.print());
    document.querySelector("#report-export")?.addEventListener("click", () => window.print());

    function showFeedback(msg) {
      if (!feedback) return;
      feedback.textContent = msg;
      feedback.hidden = false;
      window.setTimeout(() => {
        feedback.hidden = true;
      }, 4000);
    }

    function updateReportHeader(titleText) {
      if (reportTitleEl) reportTitleEl.textContent = titleText;
      if (reportPeriodEl) reportPeriodEl.textContent = activePeriod.label;
      if (reportAuthorEl) reportAuthorEl.textContent = `${fullName} (${session.role})`;

      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }).format(now);
      if (reportGenTimeEl) reportGenTimeEl.textContent = `${formatted} PHT`;
    }

    // Helper: KPI card component
    function createKpiCard(label, val, subtitle = "", isAlert = false) {
      return `
        <article class="dashboard-panel report-summary-card ${isAlert ? "is-over-budget" : ""}" style="padding:16px 18px;">
          <span style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:#5b6b80;letter-spacing:0.04em;">${label}</span>
          <strong style="font-size:22px;color:#0e3556;margin:4px 0;">${val}</strong>
          ${subtitle ? `<small style="font-size:11.5px;color:#6b7a8f;">${subtitle}</small>` : ""}
        </article>
      `;
    }

    /* ---------- Report Generators for 8 Categories ---------- */

    // 1. Consolidated Summary Report
    function renderConsolidatedSummary() {
      updateReportHeader("Consolidated Financial Summary Report");

      const inc = window.FMIS.getIncomeMetrics(activePeriod);
      const exp = window.FMIS.getExpenseMetrics(activePeriod);
      const cash = window.FMIS.getCashFlowMetrics(activePeriod);
      const budget = window.FMIS.getBudgetMetrics(activePeriod);
      const indicators = window.FMIS.getFinancialIndicators(activePeriod);
      const opResult = window.FMIS.subMoney(inc.totalRevenue, exp.totalExpenses);

      reportBodyEl.innerHTML = `
        <!-- Section 1: Executive Financial Summary -->
        <div class="report-section">
          <h3 class="report-section-title">Section 1: Executive Financial Summary</h3>
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Revenue", window.FMIS.money(inc.totalRevenue), `${inc.invoiceCount} invoices`)}
            ${createKpiCard("Total Expenses", window.FMIS.money(exp.totalExpenses), `${exp.expenseCount} payables`)}
            ${createKpiCard("Operating Result", window.FMIS.money(opResult), opResult >= 0 ? "Favorable operational flow" : "Operational deficit", opResult < 0)}
            ${createKpiCard("Accounts Receivable", window.FMIS.money(inc.outstandingAR), `${inc.unpaidCount + inc.partialCount} invoices open`)}
            ${createKpiCard("Accounts Payable", window.FMIS.money(exp.outstandingAP), `${exp.openCount} payables open`)}
            ${createKpiCard("Cash Position", window.FMIS.money(cash.closingCash), "Recorded cash balance")}
          </div>
        </div>

        <!-- Section 2: Revenue Analysis -->
        <div class="report-section">
          <h3 class="report-section-title">Section 2: Revenue & Invoicing Analysis</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Revenue Category</th>
                  <th>Invoiced Count</th>
                  <th>Invoiced Amount</th>
                  <th>Amount Collected</th>
                  <th>Outstanding Balance</th>
                  <th>Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const catMap = {};
                  inc.records.forEach((r) => {
                    const c = r.category || "General";
                    if (!catMap[c]) catMap[c] = { count: 0, amt: 0, rec: 0 };
                    catMap[c].count++;
                    catMap[c].amt = window.FMIS.addMoney(catMap[c].amt, r.amount);
                    catMap[c].rec = window.FMIS.addMoney(catMap[c].rec, r.received);
                  });
                  if (!Object.keys(catMap).length) {
                    return `<tr><td colspan="6" style="text-align:center;color:#6b7a8f;">No revenue recorded for this period.</td></tr>`;
                  }
                  return Object.entries(catMap).map(([c, data]) => {
                    const bal = window.FMIS.subMoney(data.amt, data.rec);
                    const rate = data.amt > 0 ? ((data.rec / data.amt) * 100).toFixed(1) : "0.0";
                    return `
                      <tr>
                        <td><strong>${c}</strong></td>
                        <td style="text-align:center;">${data.count}</td>
                        <td class="report-amount-cell">${window.FMIS.money(data.amt)}</td>
                        <td class="report-amount-cell">${window.FMIS.money(data.rec)}</td>
                        <td class="report-amount-cell">${window.FMIS.money(bal)}</td>
                        <td style="text-align:right;">${rate}%</td>
                      </tr>
                    `;
                  }).join("");
                })()}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th style="text-align:center;">${inc.invoiceCount}</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.totalRevenue)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.totalCollected)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.outstandingAR)}</th>
                  <th style="text-align:right;">${inc.totalRevenue > 0 ? ((inc.totalCollected / inc.totalRevenue) * 100).toFixed(1) : "0.0"}%</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Section 3: Expense Analysis -->
        <div class="report-section">
          <h3 class="report-section-title">Section 3: Expenditure Analysis by Cost Center</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Cost Center</th>
                  <th>Transaction Count</th>
                  <th>Total Incurred</th>
                  <th>Amount Paid</th>
                  <th>Outstanding Payable</th>
                  <th>Share of Expenses</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const catMap = {};
                  exp.records.forEach((r) => {
                    const c = r.category || "General";
                    if (!catMap[c]) catMap[c] = { count: 0, amt: 0, paid: 0 };
                    catMap[c].count++;
                    catMap[c].amt = window.FMIS.addMoney(catMap[c].amt, r.amount);
                    if (r.payableStatus === "Paid") {
                      catMap[c].paid = window.FMIS.addMoney(catMap[c].paid, r.amount);
                    }
                  });
                  if (!Object.keys(catMap).length) {
                    return `<tr><td colspan="6" style="text-align:center;color:#6b7a8f;">No expenses recorded for this period.</td></tr>`;
                  }
                  return Object.entries(catMap).map(([c, data]) => {
                    const open = window.FMIS.subMoney(data.amt, data.paid);
                    const share = exp.totalExpenses > 0 ? ((data.amt / exp.totalExpenses) * 100).toFixed(1) : "0.0";
                    return `
                      <tr>
                        <td><strong>${c}</strong></td>
                        <td style="text-align:center;">${data.count}</td>
                        <td class="report-amount-cell">${window.FMIS.money(data.amt)}</td>
                        <td class="report-amount-cell">${window.FMIS.money(data.paid)}</td>
                        <td class="report-amount-cell">${window.FMIS.money(open)}</td>
                        <td style="text-align:right;">${share}%</td>
                      </tr>
                    `;
                  }).join("");
                })()}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th style="text-align:center;">${exp.expenseCount}</th>
                  <th class="report-amount-cell">${window.FMIS.money(exp.totalExpenses)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(exp.paidExpenses)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(exp.outstandingAP)}</th>
                  <th style="text-align:right;">100.0%</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Section 4: Budget Performance -->
        <div class="report-section">
          <h3 class="report-section-title">Section 4: Budget Performance &amp; Variances</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Planned Budget</th>
                  <th>Actual Expenditure</th>
                  <th>Variance (Planned − Actual)</th>
                  <th>Utilization (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${budget.categories.map((c) => `
                  <tr class="${c.isOverBudget ? "is-over-budget" : ""}">
                    <td><strong>${c.category}</strong></td>
                    <td class="report-amount-cell">${window.FMIS.money(c.planned)}</td>
                    <td class="report-amount-cell">${window.FMIS.money(c.actual)}</td>
                    <td class="report-amount-cell ${c.variance < 0 ? "report-variance-negative" : "report-variance-positive"}">
                      ${c.variance < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(c.variance))}
                    </td>
                    <td style="text-align:right;">${c.utilization.toFixed(1)}%</td>
                    <td>
                      <span class="report-status-chip ${c.isOverBudget ? "is-over-budget" : "is-within-budget"}">
                        ${c.isOverBudget ? "Over Budget" : "Within Budget"}
                      </span>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th class="report-amount-cell">${window.FMIS.money(budget.totalPlanned)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(budget.totalActual)}</th>
                  <th class="report-amount-cell ${budget.totalVariance < 0 ? "report-variance-negative" : "report-variance-positive"}">
                    ${budget.totalVariance < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(budget.totalVariance))}
                  </th>
                  <th style="text-align:right;">${budget.totalUtilization.toFixed(1)}%</th>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Section 5: Cash Flow Summary -->
        <div class="report-section">
          <h3 class="report-section-title">Section 5: Cash Flow Position Summary</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Cash Flow Item</th>
                  <th>Amount</th>
                  <th>Description / Audit Trace</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Opening Cash Balance</strong></td>
                  <td class="report-amount-cell"><strong>${window.FMIS.money(cash.openingCash)}</strong></td>
                  <td>Configured baseline liquid funds</td>
                </tr>
                <tr>
                  <td>Cash Inflows (Customer Collections)</td>
                  <td class="report-amount-cell" style="color:#0b7a62;">+${window.FMIS.money(cash.inflows)}</td>
                  <td>Cash received from customer invoices in this period</td>
                </tr>
                <tr>
                  <td>Cash Outflows (Settled Expenses)</td>
                  <td class="report-amount-cell" style="color:#b42318;">−${window.FMIS.money(cash.outflows)}</td>
                  <td>Actual disbursements made for settled payables</td>
                </tr>
                <tr>
                  <td><strong>Net Cash Movement</strong></td>
                  <td class="report-amount-cell"><strong>${cash.netCashFlow < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(cash.netCashFlow))}</strong></td>
                  <td>Inflows minus Outflows for reporting duration</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Closing Cash Balance</th>
                  <th class="report-amount-cell" style="font-size:14px;color:#0e3556;">${window.FMIS.money(cash.closingCash)}</th>
                  <th>Recorded ending liquidity</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Section 6: Supported Financial Indicators -->
        <div class="report-section">
          <h3 class="report-section-title">Section 6: Supported Financial Indicators &amp; Ratios</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Indicator Name</th>
                  <th>Classification</th>
                  <th>Calculated Value</th>
                  <th>Methodology / Accounting Assessment</th>
                </tr>
              </thead>
              <tbody>
                ${indicators.map((ind) => `
                  <tr>
                    <td><strong>${ind.name}</strong></td>
                    <td><span class="indicator-cat-badge ${ind.computable ? "" : "is-statement"}">${ind.category}</span></td>
                    <td style="font-weight:700;${ind.computable ? "color:#0e3556;" : "color:#7a889b;font-style:italic;"}">${ind.value}</td>
                    <td style="font-size:11.5px;color:#5b6b80;">${ind.explanation}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 7: Notes & Limitations -->
        <div class="report-section">
          <h3 class="report-section-title">Section 7: Notes, Accounting Basis, and Limitations</h3>
          <div class="report-notes-box">
            <h4>Important Compliance and Audit Disclosures:</h4>
            <ul>
              <li><strong>Prototype Operational Scope:</strong> FMIS-QM is an operational financial workflow management tool. This report is compiled directly from local transaction records (invoicing, collections, payables, payment requests).</li>
              <li><strong>Not an Audited Statutory Statement:</strong> This report is not a substitute for audited statutory financial statements. Full balance sheet assets, long-term liabilities, equity capital, and COGS ledgers are omitted by design in this transaction prototype.</li>
              <li><strong>Revenue vs Collections:</strong> Revenue reflects accrual invoice generation, while Cash Inflows reflect actual cash receipts collected.</li>
              <li><strong>Payable Approval vs Disbursement:</strong> Payment approval authorizes payment requests but does not execute external bank transfers.</li>
            </ul>
          </div>
        </div>
      `;
    }

    // 2. Income Report
    function renderIncomeReport() {
      updateReportHeader("Accounts Receivable & Income Statement Report");
      const inc = window.FMIS.getIncomeMetrics(activePeriod);

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Invoiced", window.FMIS.money(inc.totalRevenue), `${inc.invoiceCount} invoices`)}
            ${createKpiCard("Total Collected", window.FMIS.money(inc.totalCollected), "Cash collections")}
            ${createKpiCard("Outstanding AR", window.FMIS.money(inc.outstandingAR), `${inc.unpaidCount + inc.partialCount} invoices pending`)}
            ${createKpiCard("Fully Paid", String(inc.paidCount), "Invoices fully settled")}
            ${createKpiCard("Partially Paid", String(inc.partialCount), "Invoices with balances")}
            ${createKpiCard("Unpaid / Invoiced", String(inc.unpaidCount), "Zero collections yet")}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Detailed Income &amp; Invoices Register</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Invoice Amount</th>
                  <th>Amount Received</th>
                  <th>Outstanding Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${inc.records.length ? inc.records.map((r) => {
                  const bal = window.FMIS.subMoney(r.amount, r.received);
                  return `
                    <tr>
                      <td>${r.date}</td>
                      <td><strong>${r.invoice}</strong></td>
                      <td>${r.customer}</td>
                      <td>${r.category}</td>
                      <td>${r.description || "-"}</td>
                      <td>${r.dueDate || "-"}</td>
                      <td class="report-amount-cell">${window.FMIS.money(r.amount)}</td>
                      <td class="report-amount-cell">${window.FMIS.money(r.received)}</td>
                      <td class="report-amount-cell"><strong>${window.FMIS.money(bal)}</strong></td>
                      <td><span class="report-status-chip ${r.status === "Received" ? "is-within-budget" : r.status === "Partially Paid" ? "is-partial" : "is-invoiced"}">${r.status}</span></td>
                    </tr>
                  `;
                }).join("") : `<tr><td colspan="10" style="text-align:center;color:#6b7a8f;padding:16px;">No income records for this period.</td></tr>`}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="6">Total</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.totalRevenue)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.totalCollected)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(inc.outstandingAR)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    // 3. Expense Report
    function renderExpenseReport() {
      updateReportHeader("Accounts Payable & Expenditure Report");
      const exp = window.FMIS.getExpenseMetrics(activePeriod);

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Expenses", window.FMIS.money(exp.totalExpenses), `${exp.expenseCount} payables`)}
            ${createKpiCard("Settled / Paid", window.FMIS.money(exp.paidExpenses), `${exp.paidCount} records paid`)}
            ${createKpiCard("Outstanding AP", window.FMIS.money(exp.outstandingAP), `${exp.openCount} records open`)}
            ${createKpiCard("Vendors", String(exp.byVendor.length), "Distinct suppliers")}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Expense Breakdown by Category</h3>
          <div class="report-table-panel" style="padding:16px;margin-bottom:20px;">
            <table class="report-table">
              <thead>
                <tr><th>Category</th><th>Total Amount</th><th>Share of Expenses</th></tr>
              </thead>
              <tbody>
                ${exp.byCategory.map((c) => `
                  <tr>
                    <td><strong>${c.category}</strong></td>
                    <td class="report-amount-cell">${window.FMIS.money(c.amount)}</td>
                    <td style="text-align:right;">${c.percentage.toFixed(1)}%</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <h3 class="report-section-title">Detailed Payables Register</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense ID</th>
                  <th>Invoice Ref.</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${exp.records.length ? exp.records.map((r) => `
                  <tr>
                    <td>${r.date}</td>
                    <td><strong>${r.expenseId}</strong></td>
                    <td>${r.reference || "-"}</td>
                    <td>${r.vendor}</td>
                    <td>${r.category}</td>
                    <td>${r.dueDate || "-"}</td>
                    <td class="report-amount-cell">${window.FMIS.money(r.amount)}</td>
                    <td><span class="report-status-chip ${r.payableStatus === "Paid" ? "is-within-budget" : "is-partial"}">${r.payableStatus || "Open"}</span></td>
                  </tr>
                `).join("") : `<tr><td colspan="8" style="text-align:center;color:#6b7a8f;padding:16px;">No expenses for this period.</td></tr>`}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="6">Total</th>
                  <th class="report-amount-cell">${window.FMIS.money(exp.totalExpenses)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    // 4. Budget & Variance Report
    function renderBudgetReport() {
      updateReportHeader("Budget Allocation vs. Actual Expenditure Report");
      const budget = window.FMIS.getBudgetMetrics(activePeriod);

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Allocated Budget", window.FMIS.money(budget.totalPlanned), "Authorized planned spending")}
            ${createKpiCard("Actual Expenditures", window.FMIS.money(budget.totalActual), "Incurred period expenses")}
            ${createKpiCard("Budget Variance", `${budget.totalVariance < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(budget.totalVariance))}`, budget.totalVariance >= 0 ? "Under-budget savings" : "Budget overrun", budget.totalVariance < 0)}
            ${createKpiCard("Utilization Rate", `${budget.totalUtilization.toFixed(1)}%`, `${budget.overBudgetCount} over-budget categories`)}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Cost Center Budget Variance Matrix</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Cost Center</th>
                  <th>Planned Allocation</th>
                  <th>Actual Spend</th>
                  <th>Variance (Planned − Actual)</th>
                  <th>Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${budget.categories.map((c) => `
                  <tr class="${c.isOverBudget ? "is-over-budget" : ""}">
                    <td><strong>${c.category}</strong></td>
                    <td class="report-amount-cell">${window.FMIS.money(c.planned)}</td>
                    <td class="report-amount-cell">${window.FMIS.money(c.actual)}</td>
                    <td class="report-amount-cell ${c.variance < 0 ? "report-variance-negative" : "report-variance-positive"}">
                      ${c.variance < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(c.variance))}
                    </td>
                    <td style="text-align:right;">${c.utilization.toFixed(1)}%</td>
                    <td><span class="report-status-chip ${c.isOverBudget ? "is-over-budget" : "is-within-budget"}">${c.isOverBudget ? "Over Budget" : "Within Budget"}</span></td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th class="report-amount-cell">${window.FMIS.money(budget.totalPlanned)}</th>
                  <th class="report-amount-cell">${window.FMIS.money(budget.totalActual)}</th>
                  <th class="report-amount-cell ${budget.totalVariance < 0 ? "report-variance-negative" : "report-variance-positive"}">
                    ${budget.totalVariance < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(budget.totalVariance))}
                  </th>
                  <th style="text-align:right;">${budget.totalUtilization.toFixed(1)}%</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    // 5. Cash Flow Report
    function renderCashFlowReport() {
      updateReportHeader("Cash Flow & Liquidity Movements Report");
      const cash = window.FMIS.getCashFlowMetrics(activePeriod);
      const forecast = window.FMIS.getCashForecast(13, 3000000);

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Opening Cash", window.FMIS.money(cash.openingCash), "Period baseline")}
            ${createKpiCard("Cash Inflows", window.FMIS.money(cash.inflows), "Actual collections")}
            ${createKpiCard("Cash Outflows", window.FMIS.money(cash.outflows), "Settled payments")}
            ${createKpiCard("Net Cash Flow", `${cash.netCashFlow < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(cash.netCashFlow))}`, "Inflows − Outflows")}
            ${createKpiCard("Closing Cash", window.FMIS.money(cash.closingCash), "Recorded ending balance")}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">13-Week Cash Flow Projections</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Forecast Week</th>
                  <th>Opening Cash</th>
                  <th>Expected Receipts</th>
                  <th>Planned Payments</th>
                  <th>Net Cash Flow</th>
                  <th>Closing Cash</th>
                  <th>Liquidity Status</th>
                </tr>
              </thead>
              <tbody>
                ${forecast.map((w) => `
                  <tr class="${w.low ? "is-over-budget" : ""}">
                    <td><strong>Week ${w.week}</strong></td>
                    <td class="report-amount-cell">${window.FMIS.money(w.opening)}</td>
                    <td class="report-amount-cell" style="color:#0b7a62;">+${window.FMIS.money(w.receipts)}</td>
                    <td class="report-amount-cell" style="color:#b42318;">−${window.FMIS.money(w.payments)}</td>
                    <td class="report-amount-cell ${w.netCashFlow < 0 ? "report-variance-negative" : "report-variance-positive"}">
                      ${w.netCashFlow < 0 ? "−" : "+"}${window.FMIS.money(Math.abs(w.netCashFlow))}
                    </td>
                    <td class="report-amount-cell"><strong>${window.FMIS.money(w.closing)}</strong></td>
                    <td>
                      <span class="report-status-chip ${w.low ? "is-over-budget" : "is-within-budget"}">
                        ${w.low ? "Low Cash (< ₱3M)" : "Sufficient"}
                      </span>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 6. AR Aging Report
    function renderARAgingReport() {
      updateReportHeader("Accounts Receivable Aging Schedule");
      const aging = window.FMIS.getReceivablesAging();

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Outstanding AR", window.FMIS.money(aging.totalAR), "All open invoices")}
            ${createKpiCard("Current (Not Due)", window.FMIS.money(aging.buckets[0].amount), `${aging.buckets[0].count} invoices`)}
            ${createKpiCard("1–30 Days Overdue", window.FMIS.money(aging.buckets[1].amount), `${aging.buckets[1].count} invoices`)}
            ${createKpiCard("31–60 Days Overdue", window.FMIS.money(aging.buckets[2].amount), `${aging.buckets[2].count} invoices`)}
            ${createKpiCard("61+ Days Overdue", window.FMIS.money(aging.buckets[3].amount), `${aging.buckets[3].count} invoices`)}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Aging Distribution Matrix</h3>
          <div class="report-table-panel" style="padding:16px;margin-bottom:20px;">
            <table class="report-table">
              <thead>
                <tr><th>Aging Bracket</th><th>Count</th><th>Outstanding Balance</th><th>Share of AR</th></tr>
              </thead>
              <tbody>
                ${aging.buckets.map((b) => `
                  <tr>
                    <td><strong>${b.label}</strong></td>
                    <td style="text-align:center;">${b.count}</td>
                    <td class="report-amount-cell">${window.FMIS.money(b.amount)}</td>
                    <td style="text-align:right;">${aging.totalAR > 0 ? ((b.amount / aging.totalAR) * 100).toFixed(1) : "0.0"}%</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <h3 class="report-section-title">Aged Invoice Detail Register</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Outstanding Balance</th>
                  <th>Aging Bucket</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const allRecords = aging.buckets.flatMap((b) => b.records.map((r) => ({ ...r, bucketLabel: b.label })));
                  if (!allRecords.length) {
                    return `<tr><td colspan="7" style="text-align:center;color:#6b7a8f;padding:16px;">No outstanding customer invoices.</td></tr>`;
                  }
                  return allRecords.map((r) => `
                    <tr>
                      <td><strong>${r.invoice}</strong></td>
                      <td>${r.customer}</td>
                      <td>${r.date}</td>
                      <td>${r.dueDate || "-"}</td>
                      <td style="text-align:center;color:${r.daysOverdue > 0 ? "#b42318;" : "#5b6b80;"}">
                        ${r.daysOverdue > 0 ? `${r.daysOverdue} days` : "Current"}
                      </td>
                      <td class="report-amount-cell"><strong>${window.FMIS.money(r.balance)}</strong></td>
                      <td><span class="report-status-chip ${r.daysOverdue > 0 ? "is-partial" : "is-within-budget"}">${r.bucketLabel}</span></td>
                    </tr>
                  `).join("");
                })()}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 7. AP Aging Report
    function renderAPAgingReport() {
      updateReportHeader("Accounts Payable Aging Schedule");
      const aging = window.FMIS.getPayablesAging();

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Outstanding AP", window.FMIS.money(aging.totalAP), "All unsettled payables")}
            ${createKpiCard("Current (Not Due)", window.FMIS.money(aging.buckets[0].amount), `${aging.buckets[0].count} payables`)}
            ${createKpiCard("1–30 Days Overdue", window.FMIS.money(aging.buckets[1].amount), `${aging.buckets[1].count} payables`)}
            ${createKpiCard("31–60 Days Overdue", window.FMIS.money(aging.buckets[2].amount), `${aging.buckets[2].count} payables`)}
            ${createKpiCard("61+ Days Overdue", window.FMIS.money(aging.buckets[3].amount), `${aging.buckets[3].count} payables`)}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Aging Distribution Matrix</h3>
          <div class="report-table-panel" style="padding:16px;margin-bottom:20px;">
            <table class="report-table">
              <thead>
                <tr><th>Aging Bracket</th><th>Count</th><th>Outstanding Balance</th><th>Share of AP</th></tr>
              </thead>
              <tbody>
                ${aging.buckets.map((b) => `
                  <tr>
                    <td><strong>${b.label}</strong></td>
                    <td style="text-align:center;">${b.count}</td>
                    <td class="report-amount-cell">${window.FMIS.money(b.amount)}</td>
                    <td style="text-align:right;">${aging.totalAP > 0 ? ((b.amount / aging.totalAP) * 100).toFixed(1) : "0.0"}%</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <h3 class="report-section-title">Aged Payables Detail Register</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Expense ID</th>
                  <th>Vendor</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const allRecords = aging.buckets.flatMap((b) => b.records.map((r) => ({ ...r, bucketLabel: b.label })));
                  if (!allRecords.length) {
                    return `<tr><td colspan="8" style="text-align:center;color:#6b7a8f;padding:16px;">No outstanding vendor payables.</td></tr>`;
                  }
                  return allRecords.map((r) => `
                    <tr>
                      <td><strong>${r.expenseId}</strong></td>
                      <td>${r.vendor}</td>
                      <td>${r.reference || "-"}</td>
                      <td>${r.category}</td>
                      <td>${r.dueDate || "-"}</td>
                      <td style="text-align:center;color:${r.daysOverdue > 0 ? "#b42318;" : "#5b6b80;"}">
                        ${r.daysOverdue > 0 ? `${r.daysOverdue} days` : "Current"}
                      </td>
                      <td class="report-amount-cell"><strong>${window.FMIS.money(r.balance)}</strong></td>
                      <td><span class="report-status-chip ${r.daysOverdue > 0 ? "is-over-budget" : "is-within-budget"}">${r.bucketLabel}</span></td>
                    </tr>
                  `).join("");
                })()}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 8. Payment Approvals Report
    function renderApprovalsReport() {
      updateReportHeader("Payment Requests & Approval Audit Report");
      const app = window.FMIS.getPaymentApprovalMetrics();

      reportBodyEl.innerHTML = `
        <div class="report-section">
          <div class="report-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${createKpiCard("Total Requests", String(app.totalRequests), "All submitted requests")}
            ${createKpiCard("Pending Review", String(app.pendingCount), window.FMIS.money(app.pendingAmount))}
            ${createKpiCard("Approved Requests", String(app.approvedCount), window.FMIS.money(app.approvedAmount))}
            ${createKpiCard("Rejected Requests", String(app.rejectedCount), "Declined by approver")}
            ${createKpiCard("Returned for Correction", String(app.returnedCount), "Awaiting resubmission")}
          </div>
        </div>

        <div class="report-section">
          <h3 class="report-section-title">Payment Requests Audit Register</h3>
          <div class="report-table-panel" style="padding:16px;">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Expense Ref</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Requested Amount</th>
                  <th>Status</th>
                  <th>Prepared By</th>
                  <th>Submitted Date</th>
                  <th>Review Decision Notes</th>
                </tr>
              </thead>
              <tbody>
                ${app.requests.length ? app.requests.map((r) => `
                  <tr>
                    <td><strong>${r.requestId}</strong></td>
                    <td>${r.expenseId}</td>
                    <td>${r.vendor || "-"}</td>
                    <td>${r.category || "-"}</td>
                    <td class="report-amount-cell"><strong>${window.FMIS.money(r.amount)}</strong></td>
                    <td>
                      <span class="report-status-chip ${r.status === "Approved" ? "is-within-budget" : r.status === "Submitted" ? "is-invoiced" : "is-over-budget"}">
                        ${r.status}
                      </span>
                    </td>
                    <td>${r.preparedBy || "Preparer"}</td>
                    <td>${(r.submittedAt || r.requestedDate || "").slice(0, 10)}</td>
                    <td style="font-size:11.5px;color:#5b6b80;">${r.comments || "-"}</td>
                  </tr>
                `).join("") : `<tr><td colspan="9" style="text-align:center;color:#6b7a8f;padding:16px;">No payment requests found.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return "";
      if (window.FMIS && typeof window.FMIS.escapeHtml === "function") {
        return window.FMIS.escapeHtml(str);
      }
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function getSignoffBlockHTML() {
      return `
        <div class="report-signoff-block">
          <div class="report-signoff-item">
            <span class="report-signoff-title">Prepared By:</span>
            <div class="report-signoff-line"></div>
            <span class="report-signoff-name">${escapeHtml(fullName)}</span>
            <span class="report-signoff-role">${escapeHtml(session.role)}</span>
          </div>
          <div class="report-signoff-item">
            <span class="report-signoff-title">Reviewed By:</span>
            <div class="report-signoff-line"></div>
            <span class="report-signoff-name">Compliance &amp; Internal Audit</span>
            <span class="report-signoff-role">Quality Management Unit</span>
          </div>
          <div class="report-signoff-item">
            <span class="report-signoff-title">Approved By:</span>
            <div class="report-signoff-line"></div>
            <span class="report-signoff-name">Finance Director</span>
            <span class="report-signoff-role">Office of the Chief Financial Officer</span>
          </div>
        </div>
      `;
    }

    // Switch between the 8 report categories
    function generateCurrentReport() {
      switch (currentCategory) {
        case "summary":
          renderConsolidatedSummary();
          break;
        case "income":
          renderIncomeReport();
          break;
        case "expenses":
          renderExpenseReport();
          break;
        case "budget":
          renderBudgetReport();
          break;
        case "cashflow":
          renderCashFlowReport();
          break;
        case "ar-aging":
          renderARAgingReport();
          break;
        case "ap-aging":
          renderAPAgingReport();
          break;
        case "approvals":
          renderApprovalsReport();
          break;
        default:
          renderConsolidatedSummary();
      }
      if (reportBodyEl) {
        reportBodyEl.insertAdjacentHTML("beforeend", getSignoffBlockHTML());
      }
    }

    // Initial render
    generateCurrentReport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReports);
  } else {
    initReports();
  }
})();
