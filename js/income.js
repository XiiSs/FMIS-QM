const incomeStorageKey = "fmisIncomeRecords";
const sampleIncomeRecords = [
  {
    date: "2026-10-28",
    invoice: "INV-2026-1045",
    customer: "ABC Retail",
    category: "Product Sales",
    description: "Sale to ABC Retail",
    amount: 180000,
    received: 0,
    status: "Invoiced",
    dueDate: "2026-11-27",
  },
  {
    date: "2026-10-25",
    invoice: "INV-2026-1044",
    customer: "DEF Mart",
    category: "Product Sales",
    description: "Sale to DEF Mart",
    amount: 220000,
    received: 100000,
    status: "Partially Paid",
    dueDate: "2026-11-24",
  },
  {
    date: "2026-10-20",
    invoice: "INV-2026-1043",
    customer: "GHI Supermarket",
    category: "Product Sales",
    description: "Sale to GHI Supermarket",
    amount: 150000,
    received: 150000,
    status: "Received",
    dueDate: "2026-11-19",
  },
  {
    date: "2026-10-18",
    invoice: "INV-2026-1042",
    customer: "JKL Traders",
    category: "Other Income",
    description: "Other income from JKL Traders",
    amount: 75000,
    received: 0,
    status: "Invoiced",
    dueDate: "2026-11-17",
  },
  {
    date: "2026-10-16",
    invoice: "INV-2026-1041",
    customer: "MNO Wholesaler",
    category: "Product Sales",
    description: "Sale to MNO Wholesaler",
    amount: 200000,
    received: 50000,
    status: "Partially Paid",
    dueDate: "2026-11-15",
  },
];

const incomeSession = readIncomeSession();

if (incomeSession) {
  initializeIncomePage(incomeSession);
}

function readIncomeSession() {
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
    !session.permissions.includes("income")
  ) {
    window.location.replace("login.html");
    return null;
  }

  return session;
}

function initializeIncomePage(session) {
  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const firstName = email.startsWith("management@")
    ? "Maria"
    : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const fullName = session.fullName || (email.startsWith("management@") || email.startsWith("preparer@")
    ? "Maria G. Santos"
    : firstName);
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

  const feedback = document.querySelector("#income-feedback");
  let records = loadIncomeRecords(feedback);
  const recordRows = document.querySelector("#income-record-rows");
  const searchInput = document.querySelector("#income-search");
  const statusFilter = document.querySelector("#status-filter");
  const categoryFilter = document.querySelector("#category-filter");
  const filters = document.querySelector("#income-filters");
  const noResults = document.querySelector("#income-no-results");
  const reportPeriodSelect = document.querySelector("#report-period");
  const summaryPeriodSelect = document.querySelector("#income-period");
  let reportViewHasData = true;
  const summaryStorageKey = "fmisIncomeSummary";
  let summaryTotals = loadIncomeSummary();

  if (!canEdit) {
    document.querySelectorAll("#invoice-form input, #invoice-form select, #invoice-form textarea, #invoice-form button").forEach((control) => {
      control.disabled = true;
    });
    document.querySelectorAll(".collection-form input, .collection-form button").forEach((control) => {
      control.disabled = true;
    });
    document.querySelector("#invoice-form-title").textContent = "Income Records / Read-only";
    document.querySelector("#reset-invoice").hidden = true;
    document.querySelector("#invoice-form").querySelector('[type="submit"]').textContent = "Read-only access";
    document.querySelector(".income-prototype-note").textContent = "Finance Preparer view is editable. Management has read-only access.";
    document.querySelectorAll("[data-open-tab='record']").forEach((button) => {
      button.disabled = true;
    });
  }

  const reportFormatter = new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  });
  const formatMoney = (amount) => `₱ ${reportFormatter.format(amount)}`;

  function showFeedback(message, isError = false) {
    feedback.textContent = message;
    feedback.hidden = !message;
    feedback.classList.toggle("is-error", isError);
  }

  function renderRows() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedCategory = categoryFilter.value;
    const matchingRecords = records.filter((record) => {
      const matchesSearch = [
        record.invoice,
        record.customer,
        record.description,
        record.category,
        record.status,
      ].some((value) => value.toLowerCase().includes(query));
      return (
        matchesSearch &&
        (!selectedStatus || record.status === selectedStatus) &&
        (!selectedCategory || record.category === selectedCategory)
      );
    });

    recordRows.replaceChildren(...matchingRecords.map((record) => createIncomeRow(record, false, canEdit)));
    document.querySelectorAll("[data-shared-rows]").forEach((tbody) => {
      const collectionView = tbody.closest(".collection-table");
      const viewRecords = collectionView
        ? matchingRecords.filter((record) => record.amount > record.received)
        : matchingRecords;
      tbody.replaceChildren(...viewRecords.map((record) => createIncomeRow(record, Boolean(collectionView), canEdit)));
    });
    noResults.hidden = matchingRecords.length > 0;
    document.querySelector("#record-count").textContent =
      `Showing ${matchingRecords.length} of ${records.length} records`;
    renderSummary();
    renderReport();
  }

  function createIncomeRow(record, collectionView, editable) {
    const row = document.createElement("tr");
    const values = collectionView
      ? [
          formatDate(record.date),
          record.invoice,
          record.customer,
          formatMoney(record.amount),
          formatMoney(record.received),
          formatMoney(record.amount - record.received),
          null,
          null,
        ]
      : [
          formatDate(record.date),
          record.invoice,
          record.customer,
          record.category,
          formatMoney(record.amount),
          formatMoney(record.received),
          formatMoney(record.amount - record.received),
          null,
          null,
        ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if (value !== null) {
        cell.textContent = value;
      } else if (collectionView && index === 6) {
        cell.append(createStatusChip(record.status));
      } else if (!collectionView && index === 7) {
        cell.append(createStatusChip(record.status));
      } else if (collectionView && index === 7) {
        if (editable) {
          cell.append(createCollectionForm(record));
        } else {
          cell.textContent = "Read only";
        }
      } else {
        const action = document.createElement("button");
        action.type = "button";
        action.className = "income-row-action";
        action.textContent = "⋮";
        action.title = `View ${record.invoice}`;
        action.setAttribute("aria-label", `View ${record.invoice}`);
        action.addEventListener("click", () => {
          showFeedback(`${record.invoice} · ${record.customer} · ${record.description}`);
        });
        cell.append(action);
      }
      row.append(cell);
    });
    return row;
  }

  function createCollectionForm(record) {
    const form = document.createElement("form");
    form.className = "collection-form";
    form.dataset.invoice = record.invoice;
    const input = document.createElement("input");
    input.type = "number";
    input.name = "payment";
    input.min = "0.01";
    input.max = String(record.amount - record.received);
    input.step = "0.01";
    input.required = true;
    input.placeholder = "₱ amount";
    input.setAttribute("aria-label", `Collection amount for ${record.invoice}`);
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Receive";
    form.append(input, button);
    return form;
  }

  function createStatusChip(status) {
    const chip = document.createElement("span");
    const statusClass = status === "Received"
      ? "status-green"
      : status === "Overdue"
        ? "status-red"
        : status === "Partially Paid"
          ? "status-orange"
          : "status-blue";
    chip.className = `status-chip ${statusClass}`;
    chip.textContent = status;
    return chip;
  }

  function renderSummary() {
    const hasSummary = summaryPeriodSelect.value === "2026-10";
    const periodRecords = records.filter((record) => record.date.startsWith(summaryPeriodSelect.value));
    const invoiced = hasSummary
      ? summaryTotals.invoiced
      : periodRecords.reduce((sum, record) => sum + record.amount, 0);
    const received = hasSummary
      ? summaryTotals.received
      : periodRecords.reduce((sum, record) => sum + record.received, 0);
    const outstanding = invoiced - received;
    const overdue = hasSummary
      ? summaryTotals.overdue
      : periodRecords.filter((record) => record.status === "Overdue").length;
    document.querySelector("#summary-period").textContent = summaryPeriodSelect.selectedOptions[0].textContent;
    const hasPeriodData = hasSummary || periodRecords.length > 0;
    document.querySelector(".income-summary-list").hidden = !hasPeriodData;
    document.querySelector("#income-summary-empty").hidden = hasPeriodData;
    document.querySelector("#total-invoiced").textContent = formatMoney(invoiced);
    document.querySelector("#total-received").textContent = formatMoney(received);
    document.querySelector("#total-outstanding").textContent = formatMoney(outstanding);
    document.querySelector("#overdue-invoices").textContent = `${overdue} ${overdue === 1 ? "invoice" : "invoices"}`;
  }

  function renderReport() {
    const selectedPeriod = reportPeriodSelect.value;
    const reportRecords = records.filter((record) => record.date.startsWith(selectedPeriod));
    reportViewHasData = selectedPeriod === "2026-10" || reportRecords.length > 0;
    document.querySelectorAll("[data-income-report-month]").forEach((element) => {
      element.textContent = reportPeriodSelect.selectedOptions[0].textContent;
    });
    document.querySelector("#income-report-empty").hidden = reportViewHasData;
    document.querySelector(".income-report-cards").hidden = !reportViewHasData;
    document.querySelectorAll(".report-breakdown-title").forEach((heading) => {
      heading.hidden = !reportViewHasData;
    });
    document.querySelector("#category-report-rows").closest("table").hidden = !reportViewHasData;
    document.querySelector("#income-status-rows").closest("table").hidden = !reportViewHasData;

    if (!reportViewHasData) {
      return;
    }

    const invoiced = selectedPeriod === "2026-10"
      ? summaryTotals.invoiced
      : reportRecords.reduce((sum, record) => sum + record.amount, 0);
    const received = selectedPeriod === "2026-10"
      ? summaryTotals.received
      : reportRecords.reduce((sum, record) => sum + record.received, 0);
    document.querySelector("#report-invoiced").textContent = formatMoney(invoiced);
    document.querySelector("#report-received").textContent = formatMoney(received);
    document.querySelector("#report-outstanding").textContent = formatMoney(invoiced - received);
    document.querySelector("#report-invoice-count").textContent = String(reportRecords.length);
    const categories = [...new Set(reportRecords.map((record) => record.category))];
    document.querySelector("#category-report-rows").replaceChildren(
      ...categories.map((category) => {
        const categoryRecords = reportRecords.filter((record) => record.category === category);
        const categoryInvoiced = categoryRecords.reduce((sum, record) => sum + record.amount, 0);
        const categoryReceived = categoryRecords.reduce((sum, record) => sum + record.received, 0);
        const row = document.createElement("tr");
        [category, String(categoryRecords.length), formatMoney(categoryInvoiced), formatMoney(categoryReceived), formatMoney(categoryInvoiced - categoryReceived)].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }),
    );
    const statuses = [...new Set(reportRecords.map((record) => record.status))];
    document.querySelector("#income-status-rows").replaceChildren(
      ...statuses.map((status) => {
        const statusRecords = reportRecords.filter((record) => record.status === status);
        const statusInvoiced = statusRecords.reduce((sum, record) => sum + record.amount, 0);
        const statusReceived = statusRecords.reduce((sum, record) => sum + record.received, 0);
        const row = document.createElement("tr");
        [status, String(statusRecords.length), formatMoney(statusInvoiced), formatMoney(statusReceived), formatMoney(statusInvoiced - statusReceived)].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }),
    );
  }

  document.querySelectorAll("[data-income-tab]").forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.incomeTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const tabs = [...document.querySelectorAll("[data-income-tab]")];
      const index = tabs.indexOf(tab);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      tabs[(index + direction + tabs.length) % tabs.length].click();
      tabs[(index + direction + tabs.length) % tabs.length].focus();
    });
  });

  function selectTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll("[data-income-tab]").forEach((tab) => {
      const selected = tab.dataset.incomeTab === tabName;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll("[data-income-view]").forEach((view) => {
      view.hidden = view.dataset.incomeView !== tabName;
    });
    showFeedback("");
    if (tabName === "reports") {
      renderReport();
    }
  }

  document.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.openTab));
  });

  const form = document.querySelector("#invoice-form");
  const invoiceAmountInput = document.querySelector("#invoice-amount");
  const amountReceivedInput = document.querySelector("#amount-received");
  const balanceInput = document.querySelector("#outstanding-balance");
  const invoiceStatusSelect = document.querySelector("#invoice-status");
  const dueDateInput = document.querySelector("#due-date");

  function updateInvoiceBalance() {
    const amount = Number(invoiceAmountInput.value) || 0;
    const received = Number(amountReceivedInput.value) || 0;
    balanceInput.value = formatMoney(Math.max(0, amount - received));
    amountReceivedInput.max = String(amount);
    if (amount > 0) {
      invoiceStatusSelect.value = received >= amount
        ? "Received"
        : received > 0
          ? "Partially Paid"
          : "Invoiced";
    }
  }

  invoiceAmountInput.addEventListener("input", updateInvoiceBalance);
  amountReceivedInput.addEventListener("input", updateInvoiceBalance);
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      balanceInput.value = "₱ 0";
      document.querySelector("#description-count").textContent = "0/255";
      showFeedback("");
    }, 0);
  });
  document.querySelector("#description").addEventListener("input", (event) => {
    document.querySelector("#description-count").textContent = `${event.target.value.length}/255`;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit || !form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const amount = Number(formData.get("invoiceAmount"));
    const received = Number(formData.get("amountReceived")) || 0;
    const invoiceSuffix = String(formData.get("invoiceReference")).trim();
    if (!Number.isFinite(amount) || !Number.isFinite(received) || amount <= 0 || received < 0 || received > amount) {
      showFeedback("Enter a valid invoice amount and a received amount no greater than the invoice total.", true);
      return;
    }
    const invoice = invoiceSuffix.startsWith("INV-")
      ? invoiceSuffix
      : `INV-2026-${invoiceSuffix}`;

    if (records.some((record) => record.invoice.toLowerCase() === invoice.toLowerCase())) {
      showFeedback("That invoice reference already exists. Enter a unique reference.", true);
      return;
    }

    const newRecord = {
      date: String(formData.get("invoiceDate")),
      invoice,
      customer: String(formData.get("customer")),
      category: String(formData.get("category")),
      description: String(formData.get("description")).trim(),
      amount,
      received,
      status: getInvoiceStatus(amount, received, String(formData.get("dueDate"))),
      dueDate: String(formData.get("dueDate")),
    };
    records.unshift(newRecord);
    summaryTotals.invoiced += amount;
    summaryTotals.received += received;
    if (newRecord.status === "Overdue") {
      summaryTotals.overdue += 1;
    }
    if (!saveIncomeRecords(records, feedback) || !saveIncomeSummary(summaryTotals, feedback)) {
      records.shift();
      summaryTotals.invoiced -= amount;
      summaryTotals.received -= received;
      if (newRecord.status === "Overdue") {
        summaryTotals.overdue -= 1;
      }
      return;
    }
    if (window.FMIS) window.FMIS.logActivity({
      action: "Saved income",
      reference: invoice,
      before: "",
      after: `${newRecord.status}; ₱${amount.toFixed(2)}`,
      type: "Income",
    });
    renderRows();
    form.reset();
    selectTab("record");
    showFeedback(`Invoice ${invoice} was saved.`);
  });

  document.querySelectorAll("[data-shared-search]").forEach((input) => {
    input.addEventListener("input", () => {
      searchInput.value = input.value;
      renderRows();
    });
  });
  searchInput.addEventListener("input", () => {
    document.querySelectorAll("[data-shared-search]").forEach((input) => {
      input.value = searchInput.value;
    });
    renderRows();
  });
  statusFilter.addEventListener("change", renderRows);
  categoryFilter.addEventListener("change", renderRows);
  document.querySelector("#filter-toggle").addEventListener("click", (event) => {
    const isOpen = !filters.hidden;
    filters.hidden = isOpen;
    event.currentTarget.setAttribute("aria-expanded", String(!isOpen));
  });
  summaryPeriodSelect.addEventListener("change", renderSummary);
  reportPeriodSelect.addEventListener("change", renderReport);

  document.querySelectorAll(".income-table").forEach((table) => {
    table.addEventListener("submit", (event) => {
      const collectionForm = event.target.closest(".collection-form");
      if (!collectionForm) {
        return;
      }
      event.preventDefault();
      if (!canEdit) {
        return;
      }
      const invoice = collectionForm.dataset.invoice;
      const record = records.find((item) => item.invoice === invoice);
      const payment = Number(new FormData(collectionForm).get("payment"));
      if (!record || !Number.isFinite(payment) || payment <= 0 || payment > record.amount - record.received) {
        showFeedback("Enter a collection amount no greater than the outstanding balance.", true);
        return;
      }
      const previousStatus = record.status;
      record.received += payment;
      record.status = getInvoiceStatus(record.amount, record.received, record.dueDate);
      summaryTotals.received += payment;
      if (previousStatus === "Overdue" && record.status !== "Overdue") {
        summaryTotals.overdue -= 1;
      }
      if (!saveIncomeRecords(records, feedback) || !saveIncomeSummary(summaryTotals, feedback)) {
        record.received -= payment;
        record.status = previousStatus;
        summaryTotals.received -= payment;
        if (previousStatus === "Overdue" && record.status !== "Overdue") {
          summaryTotals.overdue += 1;
        }
        return;
      }
      if (window.FMIS) window.FMIS.logActivity({
        action: "Recorded customer collection",
        reference: invoice,
        before: previousStatus,
        after: record.status,
        type: "Income",
      });
      renderRows();
      showFeedback(`Collection of ${formatMoney(payment)} recorded for ${invoice}.`);
    });
  });

  document.querySelector("#export-income").addEventListener("click", () => {
    exportIncomeRecords(records.filter((record) => {
      const query = searchInput.value.trim().toLowerCase();
      return [
        record.invoice,
        record.customer,
        record.description,
        record.category,
        record.status,
      ].some((value) => value.toLowerCase().includes(query)) &&
        (!statusFilter.value || record.status === statusFilter.value) &&
        (!categoryFilter.value || record.category === categoryFilter.value);
    }));
  });

  renderRows();

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }
}

function loadIncomeRecords(feedback) {
  const storedRecords = localStorage.getItem(incomeStorageKey);
  if (storedRecords === null) {
    return sampleIncomeRecords.map((record) => ({ ...record }));
  }

  try {
    const records = JSON.parse(storedRecords);
    if (!Array.isArray(records) || records.some((record) =>
      typeof record.invoice !== "string" ||
      typeof record.customer !== "string" ||
      typeof record.category !== "string" ||
      typeof record.amount !== "number" ||
      typeof record.received !== "number" ||
      typeof record.date !== "string" ||
      typeof record.status !== "string"
    )) {
      throw new TypeError("Saved income data has an invalid format.");
    }
    return records;
  } catch (error) {
    feedback.textContent = `Saved income data could not be read: ${error.message}`;
    feedback.hidden = false;
    feedback.classList.add("is-error");
    return sampleIncomeRecords.map((record) => ({ ...record }));
  }
}

function saveIncomeRecords(records, feedback) {
  try {
    localStorage.setItem(incomeStorageKey, JSON.stringify(records));
    return true;
  } catch (error) {
    feedback.textContent = `Income changes could not be saved in this browser: ${error.message}`;
    feedback.hidden = false;
    feedback.classList.add("is-error");
    return false;
  }
}

function loadIncomeSummary() {
  const storedSummary = localStorage.getItem("fmisIncomeSummary");
  if (storedSummary === null) {
    return { invoiced: 1200000, received: 950000, overdue: 5 };
  }

  try {
    const summary = JSON.parse(storedSummary);
    if (
      typeof summary.invoiced !== "number" ||
      typeof summary.received !== "number" ||
      typeof summary.overdue !== "number" ||
      summary.invoiced < summary.received ||
      summary.received < 0 ||
      summary.overdue < 0
    ) {
      throw new TypeError("Saved income summary has an invalid format.");
    }
    return summary;
  } catch (error) {
    const feedback = document.querySelector("#income-feedback");
    feedback.textContent = `Saved income summary could not be read: ${error.message}`;
    feedback.hidden = false;
    feedback.classList.add("is-error");
    return { invoiced: 1200000, received: 950000, overdue: 5 };
  }
}

function saveIncomeSummary(summary, feedback) {
  try {
    localStorage.setItem("fmisIncomeSummary", JSON.stringify(summary));
    return true;
  } catch (error) {
    feedback.textContent = `Income summary could not be saved in this browser: ${error.message}`;
    feedback.hidden = false;
    feedback.classList.add("is-error");
    return false;
  }
}

function getInvoiceStatus(amount, received, dueDate) {
  if (received >= amount) {
    return "Received";
  }
  if (dueDate < new Date().toISOString().slice(0, 10)) {
    return "Overdue";
  }
  if (received > 0) {
    return "Partially Paid";
  }
  return "Invoiced";
}

function exportIncomeRecords(records) {
  const columns = ["Date", "Invoice No.", "Customer / Source", "Category", "Description", "Invoice Amount (PHP)", "Amount Received (PHP)", "Outstanding Balance (PHP)", "Status"];
  const escapeCell = (value) => {
    const safeValue = String(value).replace(/^[=+\-@]/, "'$&");
    return `"${safeValue.replace(/"/g, '""')}"`;
  };
  const rows = records.map((record) => [
    record.date,
    record.invoice,
    record.customer,
    record.category,
    record.description,
    record.amount.toFixed(2),
    record.received.toFixed(2),
    (record.amount - record.received).toFixed(2),
    record.status,
  ]);
  const csv = [columns, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "income-records.csv";
  link.click();
  URL.revokeObjectURL(url);
}