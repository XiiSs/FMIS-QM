const transactionRecordsKey = "fmisIncomeRecords";
const transactionSummaryKey = "fmisIncomeSummary";
const seedTransactionRecords = [
  { date: "2026-10-28", invoice: "INV-2026-1045", customer: "ABC Retail", category: "Product Sales", description: "Sale to ABC Retail", amount: 180000, received: 0, status: "Invoiced", dueDate: "2026-11-27" },
  { date: "2026-10-25", invoice: "INV-2026-1044", customer: "DEF Mart", category: "Product Sales", description: "Sale to DEF Mart", amount: 220000, received: 100000, status: "Partially Paid", dueDate: "2026-11-24" },
  { date: "2026-10-20", invoice: "INV-2026-1043", customer: "GHI Supermarket", category: "Product Sales", description: "Sale to GHI Supermarket", amount: 150000, received: 150000, status: "Received", dueDate: "2026-11-19" },
  { date: "2026-10-18", invoice: "INV-2026-1042", customer: "JKL Traders", category: "Other Income", description: "Other income from JKL Traders", amount: 75000, received: 0, status: "Invoiced", dueDate: "2026-11-17" },
  { date: "2026-10-16", invoice: "INV-2026-1041", customer: "MNO Wholesaler", category: "Product Sales", description: "Sale to MNO Wholesaler", amount: 200000, received: 50000, status: "Partially Paid", dueDate: "2026-11-15" },
];

function getTransactionSession() {
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

const transactionSession = getTransactionSession();

if (transactionSession) {
  initializeTransactionPage(transactionSession);
}

function initializeTransactionPage(session) {
  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const firstName = email.startsWith("management@")
    ? "Maria"
    : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const fullName = email.startsWith("management@") || email.startsWith("preparer@")
    ? "Maria G. Santos"
    : firstName;
  const initials = fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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

  const form = document.querySelector("#revenue-form");
  const dateInput = document.querySelector("#revenue-date");
  const dueDateInput = document.querySelector("#revenue-due-date");
  const amountInput = document.querySelector("#revenue-amount");
  const receivedInput = document.querySelector("#revenue-received");
  const balanceInput = document.querySelector("#revenue-balance");
  const statusInput = document.querySelector("#revenue-status");
  const feedback = document.querySelector("#transaction-feedback");
  const feedbackTitle = document.querySelector("#transaction-feedback-title");
  const feedbackMessage = document.querySelector("#transaction-feedback-message");
  const referenceInput = document.querySelector("#revenue-reference");
  const moneyFormat = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let records = getTransactionRecords(feedback, feedbackTitle, feedbackMessage);
  let reportSummary = getTransactionSummary(feedback, feedbackTitle, feedbackMessage);
  let keepFeedbackAfterReset = false;

  function formatMoney(amount) {
    return `₱${moneyFormat.format(amount)}`;
  }

  function setFieldError(name, message) {
    const field = form.elements.namedItem(name);
    const error = document.querySelector(`[data-error-for="${name}"]`);
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (field) {
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function clearFieldErrors() {
    form.querySelectorAll("[data-error-for]").forEach((error) => {
      error.textContent = "";
      error.hidden = true;
    });
    form.querySelectorAll("[aria-invalid]").forEach((field) => {
      field.removeAttribute("aria-invalid");
    });
  }

  function showFeedback(type, title, message) {
    feedback.dataset.state = type;
    feedbackTitle.textContent = title;
    feedbackMessage.textContent = message;
    feedback.hidden = false;
  }

  function dismissFeedback() {
    feedback.hidden = true;
  }

  function updateBalance() {
    const amount = Number(amountInput.value) || 0;
    const received = Number(receivedInput.value) || 0;
    receivedInput.max = amount > 0 ? String(amount) : "";
    balanceInput.value = moneyFormat.format(Math.max(0, amount - received));

    if (amount > 0 && received >= 0 && received <= amount) {
      statusInput.value = received >= amount
        ? "Received"
        : received > 0
          ? "Partially Paid"
          : "Invoiced";
    }
  }

  function updateDateConstraints() {
    dueDateInput.min = dateInput.value;
    if (dueDateInput.value && dateInput.value && dueDateInput.value < dateInput.value) {
      dueDateInput.setCustomValidity("Due date must be on or after the transaction date.");
    } else {
      dueDateInput.setCustomValidity("");
    }
  }

  const today = new Date();
  const todayString = formatDateValue(today);
  const defaultDueDate = new Date(today);
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  dateInput.value = todayString;
  dueDateInput.value = formatDateValue(defaultDueDate);
  receivedInput.value = "0.00";
  statusInput.value = "Invoiced";
  updateBalance();
  updateDateConstraints();

  amountInput.addEventListener("input", updateBalance);
  receivedInput.addEventListener("input", updateBalance);
  dateInput.addEventListener("change", updateDateConstraints);
  dueDateInput.addEventListener("change", updateDateConstraints);
  statusInput.addEventListener("change", () => {
    const amount = Number(amountInput.value) || 0;
    const received = Number(receivedInput.value) || 0;
    if (statusInput.value === "Received" && amount > 0) {
      receivedInput.value = String(amount);
    } else if (statusInput.value === "Invoiced") {
      receivedInput.value = "0.00";
    } else if (statusInput.value === "Partially Paid" && amount > 0 && (received <= 0 || received >= amount)) {
      receivedInput.value = (amount / 2).toFixed(2);
    }
    updateBalance();
  });
  [dateInput, dueDateInput, amountInput, receivedInput].forEach((field) => {
    field.addEventListener("input", () => {
      setFieldError(field.name, "");
      dismissFeedback();
    });
  });
  [form.elements.customer, form.elements.category, statusInput, referenceInput].forEach((field) => {
    field.addEventListener("input", () => {
      setFieldError(field.name, "");
      dismissFeedback();
    });
    field.addEventListener("change", () => {
      setFieldError(field.name, "");
      dismissFeedback();
    });
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      dateInput.value = todayString;
      dueDateInput.value = formatDateValue(defaultDueDate);
      receivedInput.value = "0.00";
      statusInput.value = "Invoiced";
      balanceInput.value = "0.00";
      clearFieldErrors();
      updateDateConstraints();
      if (keepFeedbackAfterReset) {
        keepFeedbackAfterReset = false;
      } else {
        dismissFeedback();
      }
    }, 0);
  });

  function validateRevenue(data) {
    clearFieldErrors();
    const errors = [];
    const reference = data.reference.trim();
    const amount = Number(data.amount);
    const received = Number(data.received);
    const normalizedReference = reference.toLowerCase();

    if (!data.date) {
      errors.push(["date", "Enter a transaction date."]);
    }
    if (!data.customer.trim()) {
      errors.push(["customer", "Enter a source or customer."]);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(["amount", "Amount must be greater than zero."]);
    }
    if (!data.category) {
      errors.push(["category", "Select a revenue category."]);
    }
    if (!reference) {
      errors.push(["reference", "Enter a transaction reference."]);
    } else if (records.some((record) => record.invoice.trim().toLowerCase() === normalizedReference)) {
      errors.push(["reference", "This transaction reference already exists. Use a different reference."]);
    }
    if (!Number.isFinite(received) || received < 0 || received > amount) {
      errors.push(["received", "Received amount must be between zero and the total amount."]);
    }
    if (!data.dueDate) {
      errors.push(["dueDate", "Enter a due date."]);
    } else if (data.date && data.dueDate < data.date) {
      errors.push(["dueDate", "Due date must be on or after the transaction date."]);
    }

    const expectedStatus = received >= amount
      ? "Received"
      : received > 0
        ? "Partially Paid"
        : "Invoiced";
    if (Number.isFinite(amount) && amount > 0 && expectedStatus !== data.status) {
      errors.push(["status", "Invoice status must match the received amount."]);
    }

    errors.forEach(([name, message]) => setFieldError(name, message));
    return errors;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    dismissFeedback();

    if (!canEdit) {
      showFeedback("error", "Read-only access", "Only a Finance Preparer can record revenue.");
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const errors = validateRevenue(data);

    if (errors.length > 0) {
      const duplicateReference = errors.some(([name]) => name === "reference") &&
        records.some((record) => record.invoice.trim().toLowerCase() === data.reference.trim().toLowerCase());
      if (duplicateReference) {
        showFeedback("error", "Duplicate transaction reference", "This reference already exists. Please check the transaction reference and use a different one.");
      } else {
        showFeedback("error", "Please fill in all required fields.", "Review the highlighted fields and correct the information before saving.");
      }
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const amount = Number(data.amount);
    const received = Number(data.received);
    const reference = data.reference.trim();
    const year = data.date.slice(0, 4);
    const transactionId = createTransactionId(year, records);
    const newRecord = {
      date: data.date,
      invoice: reference,
      customer: data.customer.trim(),
      category: mapRevenueCategory(data.category),
      description: `${data.category} — ${data.customer.trim()}`,
      amount,
      received,
      status: data.status,
      dueDate: data.dueDate,
      transactionId,
    };

    records.unshift(newRecord);
    const previousSummaryData = { ...reportSummary };
    if (data.date.startsWith("2026-10")) {
      reportSummary.invoiced += amount;
      reportSummary.received += received;
      if (data.status === "Invoiced" && data.dueDate < todayString) {
        reportSummary.overdue += 1;
      }
    }

    let previousRecords;
    let previousSummaryStorage;
    try {
      previousRecords = localStorage.getItem(transactionRecordsKey);
      previousSummaryStorage = localStorage.getItem(transactionSummaryKey);
      localStorage.setItem(transactionRecordsKey, JSON.stringify(records));
      localStorage.setItem(transactionSummaryKey, JSON.stringify(reportSummary));
    } catch (error) {
      records.shift();
      reportSummary = previousSummaryData;
      let rollbackError = "";
      try {
        if (previousRecords === null) {
          localStorage.removeItem(transactionRecordsKey);
        } else if (previousRecords !== undefined) {
          localStorage.setItem(transactionRecordsKey, previousRecords);
        }
        if (previousSummaryStorage === null) {
          localStorage.removeItem(transactionSummaryKey);
        } else if (previousSummaryStorage !== undefined) {
          localStorage.setItem(transactionSummaryKey, previousSummaryStorage);
        }
      } catch (rollbackFailure) {
        rollbackError = ` Previous saved values could not be restored: ${rollbackFailure.message}`;
      }
      showFeedback("error", "Revenue could not be saved", `Browser storage failed: ${error.message}.${rollbackError}`);
      return;
    }

    keepFeedbackAfterReset = true;
    form.reset();
    showFeedback(
      "success",
      "Revenue saved successfully!",
      `Transaction ID: ${transactionId}  |  Amount: ${formatMoney(amount)}  |  Date: ${data.date}`,
    );
  });

  document.querySelector("#dismiss-feedback").addEventListener("click", dismissFeedback);

  if (!canEdit) {
    form.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = true;
    });
    document.querySelector(".revenue-entry-panel").insertAdjacentHTML(
      "beforebegin",
      '<p class="transaction-readonly-note">Management / Read-only — revenue entry is available to Finance Preparers.</p>',
    );
    document.querySelector(".transaction-prototype-note").textContent =
      "Finance Preparer view is editable. Management has read-only access.";
  }
}

function getTransactionRecords(feedback, title, message) {
  let savedRecords;
  try {
    savedRecords = localStorage.getItem(transactionRecordsKey);
  } catch (error) {
    feedback.hidden = false;
    feedback.dataset.state = "error";
    title.textContent = "Saved income records could not be read";
    message.textContent = error.message;
    return seedTransactionRecords.map((record) => ({ ...record }));
  }
  if (savedRecords === null) {
    return seedTransactionRecords.map((record) => ({ ...record }));
  }

  try {
    const records = JSON.parse(savedRecords);
    if (!Array.isArray(records) || records.some((record) =>
      typeof record.invoice !== "string" ||
      typeof record.customer !== "string" ||
      typeof record.amount !== "number" ||
      typeof record.received !== "number" ||
      typeof record.date !== "string"
    )) {
      throw new TypeError("Saved income records have an invalid format.");
    }
    return records;
  } catch (error) {
    feedback.hidden = false;
    feedback.dataset.state = "error";
    title.textContent = "Saved income records could not be read";
    message.textContent = error.message;
    return seedTransactionRecords.map((record) => ({ ...record }));
  }
}

function getTransactionSummary(feedback, title, message) {
  let savedSummary;
  try {
    savedSummary = localStorage.getItem(transactionSummaryKey);
  } catch (error) {
    feedback.hidden = false;
    feedback.dataset.state = "error";
    title.textContent = "Saved income summary could not be read";
    message.textContent = error.message;
    return { invoiced: 1200000, received: 950000, overdue: 5 };
  }
  if (savedSummary === null) {
    return { invoiced: 1200000, received: 950000, overdue: 5 };
  }

  try {
    const summary = JSON.parse(savedSummary);
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
    feedback.hidden = false;
    feedback.dataset.state = "error";
    title.textContent = "Saved income summary could not be read";
    message.textContent = error.message;
    return { invoiced: 1200000, received: 950000, overdue: 5 };
  }
}

function createTransactionId(year, records) {
  const existingNumbers = records
    .map((record) => record.transactionId?.match(new RegExp(`^TRX-${year}-(\\d+)$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextNumber = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
  return `TRX-${year}-${String(nextNumber).padStart(6, "0")}`;
}

function mapRevenueCategory(category) {
  if (category === "Sales Revenue") {
    return "Product Sales";
  }
  if (category === "Service Revenue") {
    return "Service Income";
  }
  return "Other Income";
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}