const reportSnapshots = {
  "2026-10": {
    income: 2100000,
    expenses: 1850000,
    cash: 5000000,
    receivables: [
      { invoice: "INV-1001", customer: "Metro Grocers", status: "Partially Paid", balance: 45000, dueDate: "2026-11-05" },
      { invoice: "INV-1004", customer: "Sunrise Cafe", status: "Invoiced", balance: 38000, dueDate: "2026-11-12" },
      { invoice: "INV-1007", customer: "Bayview Hotel", status: "Invoiced", balance: 27000, dueDate: "2026-10-18" },
    ],
    payables: [
      { expense: "EXP-2003", supplier: "PackRight Co.", balance: 31500, dueDate: "2026-10-15" },
      { expense: "EXP-2006", supplier: "City Utilities", balance: 18500, dueDate: "2026-11-08" },
    ],
    budgets: [
      { category: "Raw Materials", planned: 800000, actual: 850000 },
      { category: "Operations", planned: 500000, actual: 450000 },
      { category: "Transportation", planned: 300000, actual: 280000 },
      { category: "Utilities", planned: 200000, actual: 170000 },
      { category: "Maintenance", planned: 200000, actual: 100000 },
    ],
  },
};

function initializeReports() {
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
  const name = window.FMIS.getDisplayName(session);
  const initials = window.FMIS.getInitials(name);
  document.querySelector("#profile-name").textContent = name;
  document.querySelector("#profile-role").textContent = session.role;
  document.querySelector("#sidebar-user-name").textContent = session.role;
  document.querySelectorAll(".user-avatar").forEach((avatar) => {
    avatar.textContent = initials;
  });
  document.querySelectorAll("[data-permission]").forEach((element) => {
    if (permissions.has(element.dataset.permission)) {
      return;
    }
    if (element.classList.contains("nav-link")) {
      element.removeAttribute("href");
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
      element.classList.add("is-unavailable");
    } else {
      element.hidden = true;
    }
  });
  document.querySelectorAll('a[href="login.html"]').forEach((link) => {
    link.addEventListener("click", () => sessionStorage.removeItem("fmisSession"));
  });

  const sidebar = document.querySelector(".dashboard-sidebar");
  const menuToggle = document.querySelector("#menu-toggle");
  menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      sidebar.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
    }
  });

  const form = document.querySelector("#report-form");
  const periodSelect = document.querySelector("#report-period");
  const typeSelect = document.querySelector("#report-type");
  const feedback = document.querySelector("#report-feedback");
  const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
  const dateFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const periodFormatter = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function getPeriodDates(period) {
    const [year, month] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0));
    return {
      asOf: dateFormatter.format(lastDay),
      label: periodFormatter.format(new Date(Date.UTC(year, month - 1, 1))),
      periodEnd: `${period}-${String(lastDay.getUTCDate()).padStart(2, "0")}`,
    };
  }

  function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) {
      cell.className = className;
    }
    return cell;
  }

  function createInvoiceRow(item, asOfDate) {
    const row = document.createElement("tr");
    const reference = document.createElement("td");
    reference.className = "report-record-cell";
    const strong = document.createElement("strong");
    strong.textContent = item.invoice;
    const subline = document.createElement("small");
    subline.textContent = item.customer;
    reference.append(strong, subline);
    row.append(reference);
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    const overdue = item.balance > 0 && item.dueDate < asOfDate;
    status.className = `report-status-chip ${overdue ? "is-overdue" : item.status === "Partially Paid" ? "is-partial" : "is-invoiced"}`;
    status.textContent = overdue ? "Overdue" : item.status;
    statusCell.append(status);
    row.append(statusCell, createCell(currency.format(item.balance), "report-amount-cell"), createCell(formatShortDate(item.dueDate)));
    if (overdue) {
      row.classList.add("is-overdue-row");
    }
    return row;
  }

  function createPayableRow(item, asOfDate) {
    const row = document.createElement("tr");
    const reference = document.createElement("td");
    reference.className = "report-record-cell";
    const strong = document.createElement("strong");
    strong.textContent = item.expense;
    const subline = document.createElement("small");
    subline.textContent = item.supplier;
    reference.append(strong, subline);
    const overdue = item.balance > 0 && item.dueDate < asOfDate;
    row.append(reference, createCell(currency.format(item.balance), "report-amount-cell"));
    const dueDate = createCell(formatShortDate(item.dueDate));
    if (overdue) {
      dueDate.classList.add("report-overdue-date");
      dueDate.append(document.createTextNode(" "));
      const badge = document.createElement("span");
      badge.className = "report-overdue-badge";
      badge.textContent = "Overdue";
      dueDate.append(badge);
      row.classList.add("is-overdue-row");
    }
    row.append(dueDate);
    return row;
  }

  function createBudgetRow(item) {
    const variance = item.planned - item.actual;
    const row = document.createElement("tr");
    if (variance < 0) {
      row.classList.add("is-over-budget");
    }
    row.append(
      createCell(item.category, "report-category-cell"),
      createCell(currency.format(item.planned), "report-amount-cell"),
      createCell(currency.format(item.actual), "report-amount-cell"),
      createCell(`${variance < 0 ? "−" : "+"}${currency.format(Math.abs(variance))}`, `report-amount-cell ${variance < 0 ? "report-variance-negative" : "report-variance-positive"}`),
    );
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `report-status-chip ${variance < 0 ? "is-over-budget" : "is-within-budget"}`;
    status.textContent = variance < 0 ? "Over Budget" : "Within Budget";
    statusCell.append(status);
    row.append(statusCell);
    return row;
  }

  function renderReport() {
    const period = periodSelect.value;
    const reportType = typeSelect.value;
    const dates = getPeriodDates(period);
    let snapshot = reportSnapshots[period];
    if (snapshot && window.FMIS) {
      const summary = window.FMIS.summarize();
      const incomeRecords = window.FMIS.read(window.FMIS.keys.income, []);
      const expenseRecords = window.FMIS.read(window.FMIS.keys.expenses, []);
      const liveReceivables = incomeRecords
        .filter((record) => String(record.date || "").startsWith(period))
        .map((record) => ({
          invoice: record.invoice,
          customer: record.customer,
          status: record.status,
          balance: Math.max(0, Number(record.amount || 0) - Number(record.received || 0)),
          dueDate: record.dueDate || `${period}-28`,
        }))
        .filter((record) => record.balance > 0);
      const livePayables = expenseRecords
        .filter((record) => String(record.date || "").startsWith(period) && record.payableStatus !== "Paid")
        .map((record) => ({
          expense: record.expenseId,
          supplier: record.vendor,
          balance: Number(record.amount || 0),
          dueDate: record.dueDate || `${period}-28`,
        }));
      const liveBudgets = snapshot.budgets.map((budget) => ({ ...budget }));
      expenseRecords
        .filter((record) => String(record.date || "").startsWith(period))
        .forEach((record) => {
          const budget = liveBudgets.find((item) =>
            item.category.toLowerCase() === String(record.category || "").toLowerCase(),
          );
          if (budget) budget.actual += Number(record.amount || 0);
        });
      snapshot = {
        ...snapshot,
        income: incomeRecords
          .filter((record) => String(record.date || "").startsWith(period))
          .reduce((total, record) => total + Number(record.received || 0), 0) || snapshot.income,
        expenses: expenseRecords
          .filter((record) => String(record.date || "").startsWith(period))
          .reduce((total, record) => total + Number(record.amount || 0), 0) || snapshot.expenses,
        cash: summary.cash,
        receivables: liveReceivables.length ? liveReceivables : snapshot.receivables,
        payables: livePayables.length ? livePayables : snapshot.payables,
        budgets: liveBudgets,
      };
    }
    const reportEnd = dates.periodEnd;
    document.querySelector("#report-as-of").value = dates.asOf;
    document.querySelector("#report-card-date").textContent = dates.asOf;
    document.querySelectorAll("[data-report-section]").forEach((section) => {
      const key = section.dataset.reportSection;
      const visible = reportType === "summary" ||
        (reportType === "income" && ["income", "receivables"].includes(key)) ||
        (reportType === "expenses" && ["expenses", "payables", "budget"].includes(key)) ||
        (reportType === "receivables-payables" && ["receivables", "payables"].includes(key)) ||
        (reportType === "budget" && key === "budget");
      section.hidden = !visible;
    });

    const hasData = Boolean(snapshot);
    document.querySelector("#report-income-total").textContent = hasData ? currency.format(snapshot.income) : "—";
    document.querySelector("#report-expenses-total").textContent = hasData ? currency.format(snapshot.expenses) : "—";
    document.querySelector("#report-cash-position").textContent = hasData ? currency.format(snapshot.cash) : "—";
    const receivableTotal = hasData ? snapshot.receivables.reduce((total, item) => total + item.balance, 0) : 0;
    const payableTotal = hasData ? snapshot.payables.reduce((total, item) => total + item.balance, 0) : 0;
    const plannedTotal = hasData ? snapshot.budgets.reduce((total, item) => total + item.planned, 0) : 0;
    const actualTotal = hasData ? snapshot.budgets.reduce((total, item) => total + item.actual, 0) : 0;
    const varianceTotal = plannedTotal - actualTotal;
    document.querySelector("#report-receivables-total").textContent = hasData ? currency.format(receivableTotal) : "—";
    document.querySelector("#report-payables-total").textContent = hasData ? currency.format(payableTotal) : "—";
    document.querySelector("#report-receivables-foot").textContent = currency.format(receivableTotal);
    document.querySelector("#report-payables-foot").textContent = currency.format(payableTotal);
    document.querySelector("#report-budget-planned").textContent = currency.format(plannedTotal);
    document.querySelector("#report-budget-actual").textContent = currency.format(actualTotal);
    document.querySelector("#report-budget-variance").textContent =
      `${varianceTotal < 0 ? "−" : "+"}${currency.format(Math.abs(varianceTotal))}`;

    const receivables = hasData ? snapshot.receivables : [];
    const payables = hasData ? snapshot.payables : [];
    const budgets = hasData ? snapshot.budgets : [];
    document.querySelector("#report-receivables-rows").replaceChildren(...receivables.map((item) => createInvoiceRow(item, reportEnd)));
    document.querySelector("#report-payables-rows").replaceChildren(...payables.map((item) => createPayableRow(item, reportEnd)));
    document.querySelector("#report-budget-rows").replaceChildren(...budgets.map(createBudgetRow));
    document.querySelector("#report-receivables-empty").hidden = receivables.length > 0;
    document.querySelector("#report-payables-empty").hidden = payables.length > 0;
    document.querySelector("#report-budget-empty").hidden = budgets.length > 0;
    document.querySelector("#report-receivables-empty").textContent = hasData
      ? "No outstanding invoices for this reporting period."
      : `No illustrative financial data is available for ${dates.label}.`;
    document.querySelector("#report-payables-empty").textContent = hasData
      ? "No outstanding payables for this reporting period."
      : `No illustrative financial data is available for ${dates.label}.`;
    document.querySelector("#report-budget-empty").textContent = hasData
      ? "No budget data for this reporting period."
      : `No illustrative budget data is available for ${dates.label}.`;
    feedback.hidden = true;
    document.querySelector(".report-content").dataset.periodLabel = dates.label;
  }

  function formatShortDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderReport();
    const label = getPeriodDates(periodSelect.value).label;
    feedback.textContent = reportSnapshots[periodSelect.value]
      ? `${typeSelect.selectedOptions[0].textContent} report generated for ${label}.`
      : `No illustrative report data is available for ${label}.`;
    feedback.hidden = false;
  });
  document.querySelector("#report-print").addEventListener("click", () => window.print());
  document.querySelector("#report-export").addEventListener("click", () => window.print());
  renderReport();
}

initializeReports();