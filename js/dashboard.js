/**
 * FMIS-QM Frame 1: Financial Dashboard Controller
 * Connects directly to unified local storage via FMIS Core Engine.
 */
(function () {
  "use strict";

  function initDashboard() {
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
      !session.permissions.includes("dashboard")
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
      if (element.classList.contains("summary-card") || element.classList.contains("nav-link")) {
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

    // Period selectors
    const periodSelect = document.querySelector("#report-period");
    const customRangeBar = document.querySelector("#custom-range-bar");
    const customStartInput = document.querySelector("#custom-start-date");
    const customEndInput = document.querySelector("#custom-end-date");
    const periodBadge = document.querySelector("#dashboard-period-badge");
    const lastUpdatedEl = document.querySelector("#dashboard-last-updated");
    const periodEmptyEl = document.querySelector("#period-empty");

    let activePeriod = window.FMIS.parsePeriod(periodSelect.value);

    // Period change handler
    periodSelect.addEventListener("change", () => {
      if (periodSelect.value === "custom") {
        customRangeBar.hidden = false;
        if (!customStartInput.value) customStartInput.value = "2026-10-01";
        if (!customEndInput.value) customEndInput.value = "2026-10-31";
        activePeriod = window.FMIS.parsePeriod("custom", customStartInput.value, customEndInput.value);
      } else {
        customRangeBar.hidden = true;
        activePeriod = window.FMIS.parsePeriod(periodSelect.value);
      }
      renderDashboard();
    });

    customRangeBar.addEventListener("submit", (e) => {
      e.preventDefault();
      activePeriod = window.FMIS.parsePeriod("custom", customStartInput.value, customEndInput.value);
      renderDashboard();
    });

    function updateTimestamp() {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(now);
      if (lastUpdatedEl) lastUpdatedEl.textContent = `Last updated: ${formatted} PHT`;
    }

    // Master Render Function
    function renderDashboard() {
      if (!window.FMIS) return;
      updateTimestamp();

      if (periodBadge) periodBadge.textContent = activePeriod.label;

      const incomeMetrics = window.FMIS.getIncomeMetrics(activePeriod);
      const expenseMetrics = window.FMIS.getExpenseMetrics(activePeriod);
      const cashMetrics = window.FMIS.getCashFlowMetrics(activePeriod);
      const budgetMetrics = window.FMIS.getBudgetMetrics(activePeriod);
      const indicators = window.FMIS.getFinancialIndicators(activePeriod);
      const alerts = window.FMIS.getAlerts();

      const hasTransactions = incomeMetrics.invoiceCount > 0 || expenseMetrics.expenseCount > 0;
      if (periodEmptyEl) periodEmptyEl.hidden = hasTransactions;

      // 1. Summary Cards
      // A. Total Revenue
      const revEl = document.querySelector("#card-revenue");
      const revChangeEl = document.querySelector("#card-revenue-change");
      if (revEl) revEl.textContent = window.FMIS.money(incomeMetrics.totalRevenue);
      if (revChangeEl) {
        if (incomeMetrics.changePct !== null) {
          const isUp = incomeMetrics.changePct >= 0;
          revChangeEl.innerHTML = `<b class="${isUp ? "" : "summary-change-negative"}">${isUp ? "↑" : "↓"} ${Math.abs(incomeMetrics.changePct).toFixed(1)}%</b><span>vs. ${activePeriod.prevLabel || "prev period"}</span>`;
        } else {
          revChangeEl.innerHTML = `<span>Recorded: ${incomeMetrics.invoiceCount} invoices</span>`;
        }
      }

      // B. Total Expenses
      const expEl = document.querySelector("#card-expenses");
      const expChangeEl = document.querySelector("#card-expenses-change");
      if (expEl) expEl.textContent = window.FMIS.money(expenseMetrics.totalExpenses);
      if (expChangeEl) {
        if (expenseMetrics.changePct !== null) {
          const isUp = expenseMetrics.changePct >= 0;
          expChangeEl.innerHTML = `<b class="${isUp ? "summary-change-negative" : ""}">${isUp ? "↑" : "↓"} ${Math.abs(expenseMetrics.changePct).toFixed(1)}%</b><span>vs. ${activePeriod.prevLabel || "prev period"}</span>`;
        } else {
          expChangeEl.innerHTML = `<span>Recorded: ${expenseMetrics.expenseCount} payables</span>`;
        }
      }

      // C. Accounts Receivable
      const arEl = document.querySelector("#card-ar");
      const arDetailEl = document.querySelector("#card-ar-detail");
      if (arEl) arEl.textContent = window.FMIS.money(incomeMetrics.outstandingAR);
      if (arDetailEl) {
        const openInvoices = incomeMetrics.unpaidCount + incomeMetrics.partialCount;
        arDetailEl.textContent = `${openInvoices} open invoice${openInvoices === 1 ? "" : "s"} outstanding`;
      }

      // D. Accounts Payable
      const apEl = document.querySelector("#card-ap");
      const apDetailEl = document.querySelector("#card-ap-detail");
      if (apEl) apEl.textContent = window.FMIS.money(expenseMetrics.outstandingAP);
      if (apDetailEl) {
        apDetailEl.textContent = `${expenseMetrics.openCount} payable${expenseMetrics.openCount === 1 ? "" : "s"} outstanding`;
      }

      // E. Available Cash
      const cashEl = document.querySelector("#card-cash");
      const cashDetailEl = document.querySelector("#card-cash-detail");
      if (cashEl) cashEl.textContent = window.FMIS.money(cashMetrics.closingCash);
      if (cashDetailEl) {
        cashDetailEl.textContent = `Demo cash (Opening: ${window.FMIS.money(cashMetrics.openingCash, { maximumFractionDigits: 0 })})`;
      }

      // F. Net Operating Result
      const opResult = window.FMIS.subMoney(incomeMetrics.totalRevenue, expenseMetrics.totalExpenses);
      const opResultEl = document.querySelector("#card-operating-result");
      const opDetailEl = document.querySelector("#card-operating-detail");
      const opCardEl = document.querySelector(".summary-net-income");
      if (opResultEl) opResultEl.textContent = window.FMIS.money(opResult);
      if (opDetailEl) {
        opDetailEl.textContent = `Revenue (${window.FMIS.money(incomeMetrics.totalRevenue, { maximumFractionDigits: 0 })}) − Expenses (${window.FMIS.money(expenseMetrics.totalExpenses, { maximumFractionDigits: 0 })})`;
      }
      if (opCardEl) {
        opCardEl.classList.toggle("is-negative", opResult < 0);
      }

      // 2. Financial Indicators Section
      renderIndicators(indicators);

      // 3. Financial Charts
      renderRevenueExpensesChart(incomeMetrics, expenseMetrics);
      renderCashFlowChart(cashMetrics);
      renderExpenseBreakdownChart(expenseMetrics);

      // 4. Recent Transactions Table
      renderRecentTransactions();

      // 5. Financial Alerts
      renderAlerts(alerts);
    }

    // Render Indicator Cards
    function renderIndicators(indicators) {
      const container = document.querySelector("#indicators-container");
      if (!container) return;

      container.replaceChildren(
        ...indicators.map((ind) => {
          const card = document.createElement("div");
          card.className = "indicator-card";

          const head = document.createElement("div");
          head.className = "indicator-card-head";

          const title = document.createElement("h4");
          title.className = "indicator-name";
          title.textContent = ind.name;

          const badge = document.createElement("span");
          badge.className = `indicator-cat-badge ${ind.computable ? "" : "is-statement"}`;
          badge.textContent = ind.computable ? "Operational" : "Statutory GAAP";

          head.append(title, badge);

          const valWrap = document.createElement("div");
          valWrap.className = "indicator-value-wrap";

          const val = document.createElement("span");
          val.className = `indicator-value ${ind.computable ? "" : "is-na"}`;
          val.textContent = ind.value;

          valWrap.append(val);
          if (ind.computable && ind.unit && ind.unit !== "PHP (₱)") {
            const unit = document.createElement("span");
            unit.className = "indicator-unit";
            unit.textContent = ind.unit;
            valWrap.append(unit);
          }

          const exp = document.createElement("p");
          exp.className = "indicator-explanation";
          exp.textContent = ind.explanation;

          card.append(head, valWrap, exp);
          return card;
        })
      );
    }

    // Chart 1: Revenue vs. Expenses SVG
    function renderRevenueExpensesChart(inc, exp) {
      const plot = document.querySelector("#chart-rev-exp-plot");
      const subcaption = document.querySelector("#chart-rev-exp-subcaption");
      if (!plot) return;

      if (subcaption) {
        subcaption.textContent = `Period: ${activePeriod.label} · Revenue: ${window.FMIS.money(inc.totalRevenue, { maximumFractionDigits: 0 })} vs. Expenses: ${window.FMIS.money(exp.totalExpenses, { maximumFractionDigits: 0 })}`;
      }

      const rev = inc.totalRevenue;
      const ex = exp.totalExpenses;
      const maxVal = Math.max(rev, ex, 100000);
      const svgHeight = 130;
      const svgWidth = 300;

      const revHeight = Math.max(4, Math.round((rev / maxVal) * 90));
      const expHeight = Math.max(4, Math.round((ex / maxVal) * 90));

      const revY = 105 - revHeight;
      const expY = 105 - expHeight;

      plot.innerHTML = `
        <div class="chart-y-labels" aria-hidden="true">
          <span>${window.FMIS.money(maxVal, { maximumFractionDigits: 0 })}</span>
          <span>${window.FMIS.money(maxVal / 2, { maximumFractionDigits: 0 })}</span>
          <span>₱0</span>
        </div>
        <svg class="bar-chart chart-bar-hover" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Revenue vs Expenses Comparison">
          <path class="chart-gridline" d="M0 15H300M0 60H300M0 105H300"/>
          <g class="income-bars">
            <rect x="75" y="${revY}" width="45" height="${revHeight}" rx="4">
              <title>Total Revenue: ${window.FMIS.money(rev)}</title>
            </rect>
          </g>
          <g class="expense-bars">
            <rect x="180" y="${expY}" width="45" height="${expHeight}" rx="4">
              <title>Total Expenses: ${window.FMIS.money(ex)}</title>
            </rect>
          </g>
          <text x="97" y="122" font-size="11" fill="#405066" text-anchor="middle" font-weight="600">Revenue</text>
          <text x="202" y="122" font-size="11" fill="#405066" text-anchor="middle" font-weight="600">Expenses</text>
        </svg>
      `;
    }

    // Chart 2: Cash Flow Position Movements SVG
    function renderCashFlowChart(cash) {
      const plot = document.querySelector("#chart-cash-plot");
      if (!plot) return;

      const maxVal = Math.max(cash.openingCash, cash.closingCash, cash.inflows, cash.outflows, 1000000);
      const svgHeight = 130;
      const svgWidth = 300;

      const scale = (val) => Math.max(4, Math.round((val / maxVal) * 85));
      const openH = scale(cash.openingCash);
      const inH = scale(cash.inflows);
      const outH = scale(cash.outflows);
      const closeH = scale(cash.closingCash);

      plot.innerHTML = `
        <div class="chart-y-labels" aria-hidden="true">
          <span>${window.FMIS.money(maxVal, { maximumFractionDigits: 0 })}</span>
          <span>${window.FMIS.money(maxVal / 2, { maximumFractionDigits: 0 })}</span>
          <span>₱0</span>
        </div>
        <svg class="bar-chart" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Cash Movements">
          <path class="chart-gridline" d="M0 15H300M0 60H300M0 105H300"/>
          <rect x="25" y="${105 - openH}" width="40" height="${openH}" rx="3" fill="#0e3556">
            <title>Opening Cash: ${window.FMIS.money(cash.openingCash)}</title>
          </rect>
          <rect x="95" y="${105 - inH}" width="40" height="${inH}" rx="3" fill="#0c9090">
            <title>Cash Inflows: ${window.FMIS.money(cash.inflows)}</title>
          </rect>
          <rect x="165" y="${105 - outH}" width="40" height="${outH}" rx="3" fill="#d9622b">
            <title>Cash Outflows: ${window.FMIS.money(cash.outflows)}</title>
          </rect>
          <rect x="235" y="${105 - closeH}" width="40" height="${closeH}" rx="3" fill="#1b6ca8">
            <title>Closing Cash: ${window.FMIS.money(cash.closingCash)}</title>
          </rect>
          <text x="45" y="122" font-size="10" fill="#5b6b80" text-anchor="middle">Opening</text>
          <text x="115" y="122" font-size="10" fill="#5b6b80" text-anchor="middle">Inflows</text>
          <text x="185" y="122" font-size="10" fill="#5b6b80" text-anchor="middle">Outflows</text>
          <text x="255" y="122" font-size="10" fill="#5b6b80" text-anchor="middle">Closing</text>
        </svg>
      `;
    }

    // Chart 3: Expense Breakdown by Cost Center SVG
    function renderExpenseBreakdownChart(exp) {
      const plot = document.querySelector("#chart-expense-plot");
      const legend = document.querySelector("#chart-expense-legend");
      if (!plot) return;

      const categories = exp.byCategory.length
        ? exp.byCategory
        : [
            { category: "Raw Materials", amount: 0, percentage: 0 },
            { category: "Operations", amount: 0, percentage: 0 },
            { category: "Transportation", amount: 0, percentage: 0 },
            { category: "Utilities", amount: 0, percentage: 0 },
            { category: "Maintenance", amount: 0, percentage: 0 },
          ];

      const colors = ["#0c9090", "#1b6ca8", "#e0a030", "#d9622b", "#8b5cf6", "#64748b"];
      const maxAmt = Math.max(...categories.map((c) => c.amount), 1);

      plot.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;padding:6px 0;width:100%;">
          ${categories.map((cat, idx) => {
            const widthPct = Math.max(4, Math.round((cat.amount / maxAmt) * 100));
            const color = colors[idx % colors.length];
            return `
              <div style="display:grid;grid-template-columns:110px 1fr 90px;align-items:center;gap:10px;font-size:12px;">
                <span style="font-weight:600;color:#0e3556;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat.category}</span>
                <div style="height:12px;background:#eef4fa;border-radius:6px;overflow:hidden;">
                  <div style="height:100%;width:${widthPct}%;background:${color};border-radius:6px;" title="${cat.category}: ${window.FMIS.money(cat.amount)}"></div>
                </div>
                <span style="text-align:right;font-weight:700;color:#172a43;font-variant-numeric:tabular-nums;">${window.FMIS.money(cat.amount, { maximumFractionDigits: 0 })}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;

      if (legend) {
        legend.innerHTML = `<span><i class="legend-dot legend-blue"></i>Total Period Expenses: <strong>${window.FMIS.money(exp.totalExpenses)}</strong></span>`;
      }
    }

    // Render Recent Transactions
    function renderRecentTransactions() {
      const tbody = document.querySelector("#dashboard-recent-transactions");
      if (!tbody) return;

      const income = window.FMIS.read(window.FMIS.keys.income, []).map((r) => ({
        date: r.date,
        ref: r.invoice,
        type: "Income",
        party: r.customer,
        desc: r.description || `Sale to ${r.customer}`,
        amount: r.amount,
        status: r.status,
      }));

      const expenses = window.FMIS.read(window.FMIS.keys.expenses, []).map((r) => ({
        date: r.date,
        ref: r.expenseId || r.reference,
        type: "Expense",
        party: r.vendor,
        desc: `${r.category} — ${r.vendor}`,
        amount: r.amount,
        status: r.payableStatus || "Open",
      }));

      const combined = [...income, ...expenses]
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 5);

      if (!combined.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6b7a8f;padding:16px;">No transactions found.</td></tr>`;
        return;
      }

      tbody.replaceChildren(
        ...combined.map((tx) => {
          const tr = document.createElement("tr");

          const d = document.createElement("td");
          d.textContent = tx.date;

          const ref = document.createElement("td");
          ref.className = "reference-cell";
          ref.textContent = tx.ref;

          const type = document.createElement("td");
          type.textContent = tx.type;

          const party = document.createElement("td");
          party.textContent = tx.party;

          const amt = document.createElement("td");
          amt.style.textAlign = "right";
          amt.style.fontVariantNumeric = "tabular-nums";
          amt.style.fontWeight = "600";
          amt.textContent = window.FMIS.money(tx.amount);

          const st = document.createElement("td");
          const chip = document.createElement("span");
          const isReceived = tx.status === "Received" || tx.status === "Paid";
          const isPending = tx.status === "Payment Requested" || tx.status === "Partially Paid" || tx.status === "Invoiced";
          chip.className = `status-chip ${isReceived ? "status-green" : isPending ? "status-blue" : "status-orange"}`;
          chip.textContent = tx.status;
          st.append(chip);

          tr.append(d, ref, type, party, amt, st);
          return tr;
        })
      );
    }

    // Render Financial Alerts
    function renderAlerts(alerts) {
      const container = document.querySelector("#dashboard-alerts-list");
      const topbarCount = document.querySelector("#topbar-alert-count");

      if (topbarCount) {
        topbarCount.textContent = String(alerts.length);
      }

      if (!container) return;

      if (!alerts.length) {
        container.innerHTML = `
          <div class="alert-card-item alert-info">
            <span class="alert-icon-pill">✓</span>
            <div class="alert-content-block">
              <strong>All Financial Controls Clear</strong>
              <p>No critical financial risks, budget overspending, or overdue items detected for this reporting period.</p>
            </div>
          </div>
        `;
        return;
      }

      container.replaceChildren(
        ...alerts.map((a) => {
          const item = document.createElement("div");
          item.className = `alert-card-item alert-${a.type}`;

          const icon = document.createElement("span");
          icon.className = "alert-icon-pill";
          icon.textContent = a.icon;

          const content = document.createElement("div");
          content.className = "alert-content-block";

          const title = document.createElement("strong");
          title.textContent = a.title;

          const msg = document.createElement("p");
          msg.textContent = a.message;

          const link = document.createElement("a");
          link.className = "alert-action-link";
          link.href = a.link;
          link.textContent = `${a.actionLabel} →`;

          content.append(title, msg, link);
          item.append(icon, content);
          return item;
        })
      );
    }

    // Initial render
    renderDashboard();

    // Listen to localStorage events from other tabs/workspaces
    window.addEventListener("storage", renderDashboard);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
  } else {
    initDashboard();
  }
})();