const historyExpenseRecords = [
  {
    transactionId: "TRX-2026-000042",
    date: "2026-11-13",
    customer: "Supplier Co.",
    invoice: "EXP-2026-0318",
    type: "Expense",
    category: "Other Expense",
    amount: 1200,
    status: "Pending",
    description: "Office supplies",
  },
  {
    transactionId: "TRX-2026-000039",
    date: "2026-11-12",
    customer: "Local Store",
    invoice: "EXP-2026-0317",
    type: "Expense",
    category: "Utilities",
    amount: 2450,
    status: "Overdue",
    description: "Utilities Expense",
  },
  {
    transactionId: "TRX-2026-000040",
    date: "2026-11-11",
    customer: "Online Customer",
    invoice: "INC-2026-1040",
    type: "Income",
    category: "Sales Revenue",
    amount: 3800,
    status: "Collected",
    description: "Online order payment",
  },
];

const historyIncomeSamples = [
  {
    transactionId: "TRX-2026-000045",
    date: "2026-10-28",
    customer: "ABC Corporation",
    invoice: "INV-2026-1045",
    type: "Income",
    category: "Sales Revenue",
    amount: 15000,
    received: 15000,
    status: "Collected",
    description: "Sales Revenue — ABC Corporation",
  },
  {
    transactionId: "TRX-2026-000044",
    date: "2026-10-25",
    customer: "Walk-in Customer",
    invoice: "INV-2026-1044",
    type: "Income",
    category: "Service Income",
    amount: 2500,
    received: 2500,
    status: "Collected",
    description: "Walk-in service payment",
  },
  {
    transactionId: "TRX-2026-000043",
    date: "2026-10-20",
    customer: "XYZ Retailers",
    invoice: "INV-2026-1043",
    type: "Income",
    category: "Product Sales",
    amount: 8750,
    received: 8750,
    status: "Collected",
    description: "Product sales",
  },
  {
    transactionId: "TRX-2026-000041",
    date: "2026-10-18",
    customer: "Local Store",
    invoice: "INV-2026-1042",
    type: "Income",
    category: "Sales Revenue",
    amount: 5000,
    received: 2500,
    status: "Partially Collected",
    description: "Sales Revenue — Local Store",
  },
  {
    transactionId: "TRX-2026-000038",
    date: "2026-10-16",
    customer: "Walk-in Customer",
    invoice: "INV-2026-1041",
    type: "Income",
    category: "Service Income",
    amount: 1750,
    received: 0,
    status: "Pending",
    description: "Service income",
  },
];

function getHistorySession() {
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
    !session.permissions.includes("transactions")
  ) {
    window.location.replace("login.html");
    return null;
  }

  return session;
}

const historySession = getHistorySession();

if (historySession) {
  initializeTransactionHistory(historySession);
}

function initializeTransactionHistory(session) {
  const permissions = new Set(session.permissions);
  const fullName = window.FMIS.getDisplayName(session);
  const initials = window.FMIS.getInitials(fullName);
  const canEdit = session.role !== "Management / Read-only";

  document.querySelector("#profile-name").textContent = fullName;
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
      return;
    }

    element.hidden = true;
  });

  if (!canEdit) {
    document.querySelector(".history-new-revenue").setAttribute("aria-disabled", "true");
    document.querySelector(".history-new-revenue").removeAttribute("href");
    document.querySelector(".history-new-revenue").classList.add("is-unavailable");
  }

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

  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const body = document.querySelector("#history-records");
  const search = document.querySelector("#history-search");
  const dateRange = document.querySelector("#date-range");
  const categoryFilter = document.querySelector("#history-category");
  const typeFilter = document.querySelector("#history-type");
  const statusFilter = document.querySelector("#history-status");
  const emptyMessage = document.querySelector("#history-empty");
  const applyButton = document.querySelector("#apply-history-filters");
  const customRange = document.querySelector("#history-custom-range");
  const fromInput = document.querySelector("#history-from");
  const toInput = document.querySelector("#history-to");
  const previousButton = document.querySelector("#history-prev");
  const nextButton = document.querySelector("#history-next");
  const pageLabel = document.querySelector("#history-page");
  const pageSize = 8;
  let records = loadHistoryRecords();
  let filteredRecords = [...records];
  let page = 1;
  let sortKey = "date";
  let sortDirection = "desc";

  function loadHistoryRecords() {
    let incomeRecords;
    try {
      const saved = localStorage.getItem("fmisIncomeRecords");
      incomeRecords = saved === null ? [] : JSON.parse(saved);
    } catch (error) {
      showHistoryError(`Saved income transactions could not be read: ${error.message}`);
      incomeRecords = [];
    }

    if (!Array.isArray(incomeRecords)) {
      showHistoryError("Saved income transactions are not in the expected format.");
      incomeRecords = [];
    }

    const importedIncome = incomeRecords
      .filter((record) =>
        record &&
        typeof record.invoice === "string" &&
        typeof record.date === "string" &&
        typeof record.amount === "number" &&
        typeof record.received === "number"
      )
      .map((record, index) => {
        const category = record.category === "Product Sales"
          ? "Sales Revenue"
          : record.category === "Service Income"
            ? "Service Income"
            : record.category || "Other Income";
        const id = record.transactionId || createHistoryId(record, index);
        const status = getCollectionStatus(record);
        return {
          transactionId: id,
          date: record.date,
          customer: record.customer,
          invoice: record.invoice,
          type: "Income",
          category,
          amount: record.amount,
          received: record.received,
          dueDate: record.dueDate,
          status,
          description: record.description || `${category} — ${record.customer}`,
        };
      });

    const income = importedIncome.length ? importedIncome : historyIncomeSamples;
    let savedExpenses;
    try {
      const saved = localStorage.getItem("fmisExpenseRecords");
      savedExpenses = saved === null ? [] : JSON.parse(saved);
    } catch (error) {
      showHistoryError(`Saved expense records could not be read: ${error.message}`);
      savedExpenses = [];
    }

    if (!Array.isArray(savedExpenses) || savedExpenses.some((record) =>
      !record ||
      typeof record.expenseId !== "string" ||
      typeof record.reference !== "string" ||
      typeof record.vendor !== "string" ||
      typeof record.amount !== "number" ||
      typeof record.date !== "string"
    )) {
      showHistoryError("Saved expense records are not in the expected format.");
      savedExpenses = [];
    }

    const importedExpenses = savedExpenses.map((record) => ({
      transactionId: record.expenseId,
      date: record.date,
      customer: record.vendor,
      invoice: record.reference,
      type: "Expense",
      category: record.category || "Other Expense",
      amount: record.amount,
      dueDate: record.dueDate,
      documentName: record.documentName,
      paymentRequestId: record.paymentRequestId,
      hasStoredRecord: true,
      status: record.payableStatus === "Paid"
        ? "Paid"
        : record.payableStatus === "Payment Requested"
        ? "Payment Requested"
        : record.dueDate && record.dueDate < formatDateValue(new Date())
          ? "Overdue"
          : "Pending",
      description: `${record.payableStatus || "Open"} payable${record.paymentRequestId ? ` · Payment request ${record.paymentRequestId}` : ""}${record.documentName ? ` · Supporting document ${record.documentName}` : ""}`,
    }));

    const allRecords = [...income, ...historyExpenseRecords, ...importedExpenses];
    return allRecords.sort((left, right) => right.date.localeCompare(left.date));
  }

  function createHistoryId(record, index) {
    const suffix = record.invoice.match(/(\d+)$/)?.[1];
    return `TRX-${record.date.slice(0, 4)}-${String(suffix || index + 1).padStart(6, "0")}`;
  }

  function getCollectionStatus(record) {
    if (record.received >= record.amount) {
      return "Collected";
    }
    if (record.dueDate && record.dueDate < formatDateValue(new Date())) {
      return "Overdue";
    }
    if (record.received > 0) {
      return "Partially Collected";
    }
    return "Pending";
  }

  function showHistoryError(message) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = message;
    emptyMessage.classList.add("is-error");
  }

  function applyFilters() {
    const query = search.value.trim().toLowerCase();
    const isCustom = dateRange.value === "custom";
    customRange.hidden = !isCustom;
    const days = dateRange.value === "all" || isCustom ? null : Number(dateRange.value);
    const cutoff = days === null ? null : new Date();
    if (cutoff) {
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
    }

    filteredRecords = records.filter((record) => {
      const matchesSearch = [
        record.transactionId,
        record.date,
        formatHistoryDate(record.date),
        record.invoice,
        record.customer,
        record.description,
        record.category,
        record.type,
        record.status,
      ].some((value) => String(value).toLowerCase().includes(query));
      const recordDate = new Date(`${record.date}T00:00:00`);
      return (
        matchesSearch &&
        (!cutoff || recordDate >= cutoff) &&
        (!isCustom || ((!fromInput.value || record.date >= fromInput.value) && (!toInput.value || record.date <= toInput.value))) &&
        (!categoryFilter.value || record.category === categoryFilter.value) &&
        (!typeFilter.value || record.type === typeFilter.value) &&
        (!statusFilter.value || record.status === statusFilter.value)
      );
    });

    filteredRecords.sort((left, right) => compareRecords(left, right, sortKey) * (sortDirection === "asc" ? 1 : -1));
    page = 1;
    renderHistory();
  }

  function compareRecords(left, right, key) {
    if (key === "amount") {
      return left.amount - right.amount;
    }
    if (key === "date") {
      return left.date.localeCompare(right.date);
    }
    const values = {
      id: [left.transactionId, right.transactionId],
      customer: [left.customer, right.customer],
      type: [left.type, right.type],
      category: [left.category, right.category],
      status: [left.status, right.status],
    };
    return values[key][0].localeCompare(values[key][1]);
  }

  function renderHistory() {
    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    page = Math.min(page, pageCount);
    const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);
    body.replaceChildren(...visibleRecords.map(createHistoryRow));
    emptyMessage.hidden = filteredRecords.length > 0;
    if (!emptyMessage.classList.contains("is-error")) {
      emptyMessage.textContent = "No transactions match your search and filters.";
    }

    const start = filteredRecords.length ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, filteredRecords.length);
    document.querySelector("#history-count").textContent =
      `Showing ${start}–${end} of ${filteredRecords.length} transactions`;
    pageLabel.textContent = String(page);
    previousButton.disabled = page <= 1;
    nextButton.disabled = page >= pageCount;
  }

  function createHistoryRow(record) {
    const row = document.createElement("tr");
    const values = [
      record.transactionId,
      formatHistoryDate(record.date),
      record.customer,
      record.type,
      record.category,
      `₱${moneyFormat.format(record.amount)}`,
      record.status,
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        cell.className = "history-id-cell";
        cell.textContent = value;
      } else if (index === 3) {
        const type = document.createElement("span");
        type.className = `history-type-chip ${record.type === "Income" ? "type-income" : "type-expense"}`;
        type.textContent = record.type;
        cell.append(type);
      } else if (index === 5) {
        cell.className = "history-amount-cell";
        cell.textContent = value;
      } else if (index === 6) {
        const status = document.createElement("span");
        status.className = `history-status-chip ${getStatusClass(record.status)}`;
        status.textContent = value;
        status.title = record.type === "Income" ? "Collection status" : "Payable status";
        cell.append(status);
        const kind = document.createElement("small");
        kind.className = "history-status-kind";
        kind.textContent = record.type === "Income" ? "Collection" : "Payable";
        cell.append(kind);
      } else {
        cell.textContent = value;
      }
      row.append(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.className = "history-action-cell";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "history-action-button";
    action.textContent = "⋯";
    action.setAttribute("aria-label", `View ${record.transactionId}`);
    action.title = "View transaction details";
    action.addEventListener("click", () => showTransactionDetails(record));
    actionCell.append(action);
    row.append(actionCell);
    return row;
  }

  function showTransactionDetails(record) {
    const panel = document.querySelector("#history-detail");
    const fields = document.querySelector("#history-detail-fields");
    const actions = document.querySelector("#history-detail-actions");
    const Q = window.FMISQM;
    document.querySelector("#history-detail-title").textContent = `${record.transactionId} · ${record.type}`;

    const rows = [
      ["Customer / Vendor", record.customer],
      ["Date", formatHistoryDate(record.date)],
      ["Reference / Invoice", record.invoice],
      ["Category", record.category],
      ["Amount", `₱${moneyFormat.format(record.amount)}`],
      [record.type === "Income" ? "Collection status" : "Payable status", record.status],
    ];
    if (record.type === "Income") {
      const received = Number(record.received) || 0;
      rows.push(["Amount received", `₱${moneyFormat.format(received)}`]);
      rows.push(["Balance due", `₱${moneyFormat.format(Math.max(0, record.amount - received))}`]);
    } else {
      if (record.dueDate) rows.push(["Due date", formatHistoryDate(record.dueDate)]);
      if (record.paymentRequestId) rows.push(["Payment request", record.paymentRequestId]);
      if (record.documentName) rows.push(["Supporting document", record.documentName]);
    }
    if (record.description) rows.push(["Description", record.description]);

    fields.replaceChildren(...rows.map(([label, value]) => {
      const item = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      item.append(dt, dd);
      return item;
    }));

    actions.replaceChildren();
    if (record.type === "Expense" && record.documentName && record.hasStoredRecord && Q) {
      const view = document.createElement("button");
      view.type = "button";
      view.className = "qm-button";
      view.textContent = "View supporting document";
      view.addEventListener("click", () => {
        Q.openDoc(record.transactionId).then((opened) => {
          if (!opened) showHistoryError(`${record.documentName} is recorded, but the file itself is not stored in this browser.`);
        }).catch((error) => showHistoryError(error.message));
      });
      actions.append(view);
    }
    if (record.type === "Expense") {
      const link = document.createElement("a");
      link.className = "qm-button qm-button-ghost";
      link.style.cssText = "display:inline-flex;align-items:center;text-decoration:none";
      link.href = "expenses.html";
      link.textContent = "Open Expenses & Payables";
      actions.append(link);
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function csvCell(value) {
    let text = String(value ?? "");
    // Prevent spreadsheet formula injection from user-entered text.
    if (/^[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const header = ["Transaction ID", "Date", "Customer / Vendor", "Reference", "Type", "Category", "Amount", "Status"];
    const lines = [header, ...filteredRecords.map((record) => [
      record.transactionId, record.date, record.customer, record.invoice,
      record.type, record.category, record.amount.toFixed(2), record.status,
    ])].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${formatDateValue(new Date())}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function getStatusClass(status) {
    return {
      Collected: "status-collected",
      "Partially Collected": "status-partial",
      Pending: "status-pending",
      Overdue: "status-overdue",
      "Payment Requested": "status-pending",
      Paid: "status-paid",
    }[status] || "status-pending";
  }

  search.addEventListener("input", applyFilters);
  [categoryFilter, typeFilter, statusFilter, dateRange].forEach((filter) => {
    filter.addEventListener("change", applyFilters);
  });
  applyButton.addEventListener("click", applyFilters);
  [fromInput, toInput].forEach((input) => input.addEventListener("change", applyFilters));
  document.querySelector("#export-history").addEventListener("click", exportCsv);
  document.querySelector("#history-detail-close").addEventListener("click", () => {
    document.querySelector("#history-detail").hidden = true;
  });

  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.sort;
      sortDirection = sortKey === nextKey && sortDirection === "asc" ? "desc" : "asc";
      sortKey = nextKey;
      document.querySelectorAll("[data-sort]").forEach((sortButton) => {
        sortButton.setAttribute("aria-sort", sortButton === button ? (sortDirection === "asc" ? "ascending" : "descending") : "none");
      });
      applyFilters();
    });
  });

  previousButton.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      renderHistory();
    }
  });
  nextButton.addEventListener("click", () => {
    if (page * pageSize < filteredRecords.length) {
      page += 1;
      renderHistory();
    }
  });

  applyFilters();

  function formatHistoryDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}