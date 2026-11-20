const expenseRecordsKey = "fmisExpenseRecords";
const paymentRequestsKey = "fmisPaymentRequests";

function getExpenseSession() {
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
    !session.permissions.includes("expenses")
  ) {
    window.location.replace("login.html");
    return null;
  }

  return session;
}

const expenseSession = getExpenseSession();

if (expenseSession) {
  initializeExpensePage(expenseSession);
}

function initializeExpensePage(session) {
  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const firstName = email.startsWith("management@")
    ? "Maria"
    : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const fullName = session.fullName || (email.startsWith("management@") || email.startsWith("preparer@")
    ? "Maria G. Santos"
    : firstName);
  const initials = fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  document.querySelector("#profile-name").textContent = fullName;
  document.querySelector("#profile-role").textContent = session.role;
  document.querySelector("#sidebar-user-name").textContent = session.role;
  document.querySelector("#expense-role-badge").textContent = session.role;
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

  const form = document.querySelector("#expense-form");
  const dateInput = document.querySelector("#expense-date");
  const dueDateInput = document.querySelector("#expense-due-date");
  const vendorInput = document.querySelector("#expense-vendor");
  const referenceInput = document.querySelector("#expense-reference");
  const documentInput = document.querySelector("#expense-document");
  const documentName = document.querySelector("#expense-document-name");
  const removeDocumentButton = document.querySelector("#remove-expense-document");
  const warning = document.querySelector("#expense-duplicate-warning");
  const confirmSaveButton = document.querySelector("#confirm-expense-save");
  const reviewButton = document.querySelector("#review-expense");
  const paymentRequestButton = document.querySelector("#create-payment-request");
  const feedback = document.querySelector("#expense-feedback");
  const feedbackTitle = document.querySelector("#expense-feedback-title");
  const feedbackMessage = document.querySelector("#expense-feedback-message");
  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let records = [];
  let pendingExpense = null;
  let lastSavedExpenseId = null;
  let keepFeedbackAfterReset = false;
  let storageReady = true;

  function showFeedback(type, title, message) {
    feedback.dataset.state = type;
    feedbackTitle.textContent = title;
    feedbackMessage.textContent = message;
    feedback.hidden = false;
  }

  function dismissFeedback() {
    feedback.hidden = true;
  }

  function setFieldError(name, message) {
    const field = form.elements.namedItem(name);
    const error = document.querySelector(`[data-error-for="${name}"]`);
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (field && field instanceof HTMLElement) {
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

  function clearDuplicateWarning() {
    warning.hidden = true;
    pendingExpense = null;
  }

  function setDateDefaults() {
    const today = formatDateValue(new Date());
    const due = new Date(`${today}T00:00:00`);
    due.setDate(due.getDate() + 14);
    dateInput.value = today;
    dueDateInput.value = formatDateValue(due);
    dueDateInput.min = today;
  }

  function updateDueDateConstraint() {
    dueDateInput.min = dateInput.value;
    dueDateInput.setCustomValidity(
      dueDateInput.value && dateInput.value && dueDateInput.value < dateInput.value
        ? "Due date must be on or after the expense date."
        : "",
    );
  }

  function readRecords() {
    const saved = localStorage.getItem(expenseRecordsKey);
    if (saved === null) {
      return [];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((record) =>
      !record ||
      typeof record.expenseId !== "string" ||
      typeof record.reference !== "string" ||
      typeof record.vendor !== "string" ||
      typeof record.amount !== "number" ||
      typeof record.date !== "string"
    )) {
      throw new TypeError("Saved expense records have an invalid format.");
    }
    return parsed;
  }

  function readPaymentRequests() {
    const saved = localStorage.getItem(paymentRequestsKey);
    if (saved === null) {
      return [];
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((request) =>
      !request || typeof request.requestId !== "string" || typeof request.expenseId !== "string"
    )) {
      throw new TypeError("Saved payment requests have an invalid format.");
    }
    return parsed;
  }

  try {
    records = readRecords();
  } catch (error) {
    storageReady = false;
    showFeedback("error", "Saved expenses could not be read", error.message);
  }

  setDateDefaults();
  documentInput.addEventListener("change", () => {
    const file = documentInput.files[0];
    documentName.textContent = file ? file.name : "No file selected";
    removeDocumentButton.hidden = !file;
    setFieldError("document", "");
    clearDuplicateWarning();
    dismissFeedback();
  });
  removeDocumentButton.addEventListener("click", () => {
    documentInput.value = "";
    documentInput.dispatchEvent(new Event("change"));
  });
  dateInput.addEventListener("change", () => {
    updateDueDateConstraint();
    clearDuplicateWarning();
  });
  dueDateInput.addEventListener("change", updateDueDateConstraint);

  form.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => {
      setFieldError(field.name, "");
      clearDuplicateWarning();
      dismissFeedback();
    });
    field.addEventListener("change", () => {
      setFieldError(field.name, "");
      clearDuplicateWarning();
      dismissFeedback();
    });
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      clearFieldErrors();
      clearDuplicateWarning();
      documentName.textContent = "No file selected";
      removeDocumentButton.hidden = true;
      setDateDefaults();
      if (keepFeedbackAfterReset) {
        keepFeedbackAfterReset = false;
      } else {
        dismissFeedback();
      }
    }, 0);
  });

  function collectExpense() {
    const formData = new FormData(form);
    return {
      date: String(formData.get("date") || ""),
      vendor: String(formData.get("vendor") || "").trim(),
      amount: Number(formData.get("amount")),
      category: String(formData.get("category") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      reference: String(formData.get("reference") || "").trim(),
      document: documentInput.files[0] || null,
    };
  }

  function validateExpense(data) {
    clearFieldErrors();
    const errors = [];
    if (!data.date) {
      errors.push(["date", "Enter an expense date."]);
    }
    if (!data.vendor) {
      errors.push(["vendor", "Enter a vendor."]);
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      errors.push(["amount", "Amount must be greater than zero."]);
    }
    if (!data.category) {
      errors.push(["category", "Select an expense category."]);
    }
    if (!data.dueDate) {
      errors.push(["dueDate", "Enter a due date."]);
    } else if (data.date && data.dueDate < data.date) {
      errors.push(["dueDate", "Due date must be on or after the expense date."]);
    }
    if (!data.reference) {
      errors.push(["reference", "Enter a reference or invoice number."]);
    } else if (records.some((record) =>
      record.reference.trim().toLowerCase() === data.reference.toLowerCase()
    )) {
      errors.push(["reference", "This reference / invoice number already exists."]);
    }
    if (!data.document) {
      errors.push(["document", "Attach a supporting document before saving."]);
    } else if (data.document.size > 5 * 1024 * 1024) {
      errors.push(["document", "The supporting document must be 5 MB or smaller."]);
    }
    errors.forEach(([name, message]) => setFieldError(name, message));
    return errors;
  }

  function findPossibleDuplicate(data) {
    const expenseDate = new Date(`${data.date}T00:00:00`);
    return records.find((record) => {
      if (
        record.vendor.trim().toLowerCase() !== data.vendor.toLowerCase() ||
        record.category !== data.category ||
        Math.abs(record.amount - data.amount) > 0.01
      ) {
        return false;
      }
      const existingDate = new Date(`${record.date}T00:00:00`);
      return Math.abs(expenseDate - existingDate) <= 7 * 24 * 60 * 60 * 1000;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    dismissFeedback();
    clearDuplicateWarning();

    if (!storageReady) {
      showFeedback("error", "Expense storage is unavailable", "Resolve the saved expense data error before continuing.");
      return;
    }

    const data = collectExpense();
    const errors = validateExpense(data);
    if (errors.length) {
      showFeedback("error", "Please review the required expense details.", "Correct the highlighted fields before saving.");
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    if (findPossibleDuplicate(data)) {
      pendingExpense = data;
      warning.hidden = false;
      return;
    }
    saveExpense(data);
  }

  function saveExpense(data) {
    const currentReference = data.reference.toLowerCase();
    if (records.some((record) => record.reference.trim().toLowerCase() === currentReference)) {
      clearDuplicateWarning();
      setFieldError("reference", "This reference / invoice number already exists.");
      showFeedback("error", "Duplicate invoice reference", "Use a unique reference / invoice number for each expense.");
      referenceInput.focus();
      return;
    }

    const expenseId = createExpenseId(data.date.slice(0, 4), records);
    const newRecord = {
      expenseId,
      transactionId: expenseId,
      date: data.date,
      vendor: data.vendor,
      amount: data.amount,
      category: data.category,
      dueDate: data.dueDate,
      reference: data.reference,
      documentName: data.document.name,
      documentSize: data.document.size,
      createdAt: new Date().toISOString(),
      createdBy: session.fullName || session.email,
      payableStatus: "Open",
      paymentRequestId: null,
    };

    let previousRecords;
    try {
      previousRecords = localStorage.getItem(expenseRecordsKey);
      records.unshift(newRecord);
      localStorage.setItem(expenseRecordsKey, JSON.stringify(records));
      if (window.FMIS) window.FMIS.logActivity({
        action: "Saved expense",
        reference: data.reference,
        before: "",
        after: `Saved; ₱${data.amount.toFixed(2)}`,
        type: "Expense",
      });
    } catch (error) {
      records = records.filter((record) => record.expenseId !== expenseId);
      let rollbackMessage = "";
      try {
        if (previousRecords === null) {
          localStorage.removeItem(expenseRecordsKey);
        } else if (previousRecords !== undefined) {
          localStorage.setItem(expenseRecordsKey, previousRecords);
        }
      } catch (rollbackError) {
        rollbackMessage = ` Previous saved values could not be restored: ${rollbackError.message}`;
      }
      clearDuplicateWarning();
      showFeedback("error", "Expense could not be saved", `Browser storage failed: ${error.message}.${rollbackMessage}`);
      return;
    }

    // Keep the real attached file so it can be viewed again from the register / history.
    if (window.FMISQM) {
      window.FMISQM.saveDoc(expenseId, data.document).catch((error) => {
        showFeedback("warning", "Expense saved, but the document copy could not be stored", `${error.message} The file name is still recorded on the expense.`);
      });
    }

    lastSavedExpenseId = expenseId;
    paymentRequestButton.disabled = false;
    paymentRequestButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>Create Payment Request';
    keepFeedbackAfterReset = true;
    form.reset();
    clearDuplicateWarning();
    renderPayables();
    showFeedback(
      "success",
      "Expense recorded successfully!",
      `Transaction ID: ${expenseId}  |  Payable Status: Open  |  Due Date: ${data.dueDate}  |  Outstanding Amount: ₱${moneyFormat.format(data.amount)}`,
    );
  }

  function createPaymentRequest(targetExpenseId) {
    const expenseKey = targetExpenseId || lastSavedExpenseId;
    if (!expenseKey) {
      showFeedback("error", "Payment request unavailable", "Save an expense first. Payment requests are a separate step.");
      return;
    }
    const expense = records.find((record) => record.expenseId === expenseKey);
    if (!expense) {
      showFeedback("error", "Payable record not found", "The saved expense could not be located. Refresh the Expenses page and try again.");
      return;
    }
    if (expense.paymentRequestId) {
      showFeedback("info", "Payment request already created", `Request ID: ${expense.paymentRequestId}`);
      return;
    }

    let requests;
    try {
      requests = readPaymentRequests();
    } catch (error) {
      showFeedback("error", "Payment requests could not be read", error.message);
      return;
    }

    const requestId = createPaymentRequestId(expense.date.slice(0, 4), requests);
    const request = {
      requestId,
      expenseId: expense.expenseId,
      vendor: expense.vendor,
      amount: expense.amount,
      createdAt: new Date().toISOString(),
      status: "Pending Approval",
      category: expense.category,
      dueDate: expense.dueDate,
      reference: expense.reference,
      documentName: expense.documentName,
      requestedDate: formatDateValue(new Date()),
      comments: "",
      preparedBy: session.role === "Finance Preparer" ? "Maria G. Santos" : session.email,
      preparedByEmail: session.email,
      preparedRole: session.role,
      submittedAt: new Date().toISOString(),
      history: [{
        at: new Date().toISOString(),
        user: session.role === "Finance Preparer" ? "Maria G. Santos" : session.email,
        role: session.role,
        action: "Submitted",
        status: "Pending Approval",
        comments: "Request created and submitted for approval.",
      }],
    };
    let previousExpenses;
    let previousRequests;
    expense.payableStatus = "Payment Requested";
    expense.paymentRequestId = requestId;

    try {
      previousExpenses = localStorage.getItem(expenseRecordsKey);
      previousRequests = localStorage.getItem(paymentRequestsKey);
      requests.push(request);
      localStorage.setItem(paymentRequestsKey, JSON.stringify(requests));
      localStorage.setItem(expenseRecordsKey, JSON.stringify(records));
      if (window.FMIS) window.FMIS.logActivity({
        action: "Submitted payment request",
        reference: requestId,
        before: "Saved",
        after: "Pending Approval",
        type: "Payment Request",
      });
    } catch (error) {
      expense.payableStatus = "Open";
      expense.paymentRequestId = null;
      let rollbackMessage = "";
      try {
        if (previousExpenses === null) {
          localStorage.removeItem(expenseRecordsKey);
        } else if (previousExpenses !== undefined) {
          localStorage.setItem(expenseRecordsKey, previousExpenses);
        }
        if (previousRequests === null) {
          localStorage.removeItem(paymentRequestsKey);
        } else if (previousRequests !== undefined) {
          localStorage.setItem(paymentRequestsKey, previousRequests);
        }
      } catch (rollbackError) {
        rollbackMessage = ` Previous saved values could not be restored: ${rollbackError.message}`;
      }
      showFeedback("error", "Payment request could not be created", `Browser storage failed: ${error.message}.${rollbackMessage}`);
      return;
    }

    if (expenseKey === lastSavedExpenseId) {
      paymentRequestButton.disabled = true;
      paymentRequestButton.textContent = "Request Created";
    }
    renderPayables();
    showFeedback(
      "success",
      "Payment request created separately",
      `Request ID: ${requestId}  |  Payable: ${expense.expenseId}  |  Status: Submitted. No payment was made.`,
    );
  }

  /* ---------- Payables register ---------- */
  const payablesBody = document.querySelector("#payables-body");
  const payablesEmpty = document.querySelector("#payables-empty");
  const payablesKpis = document.querySelector("#payables-kpis");
  const payablesAging = document.querySelector("#payables-aging");

  function agingLabel(expense) {
    if (expense.payableStatus === "Paid") {
      return "Settled";
    }
    const days = window.FMISQM.daysUntil(expense.dueDate);
    if (days < 0) {
      return `Overdue ${Math.abs(days)} d`;
    }
    return days === 0 ? "Due today" : `Due in ${days} d`;
  }

  function payableChipClass(expense) {
    if (expense.payableStatus === "Paid") {
      return "status-paid";
    }
    return window.FMISQM.daysUntil(expense.dueDate) < 0 ? "status-overdue" : "status-pending";
  }

  function renderPayables() {
    if (!payablesBody || !window.FMISQM) {
      return;
    }
    const Q = window.FMISQM;
    const summary = Q.payablesSummary(records);

    payablesKpis.replaceChildren(
      Q.kpi("Open payables", Q.peso(summary.openTotal), `${summary.openCount} record${summary.openCount === 1 ? "" : "s"} not yet paid`),
      Q.kpi("Overdue", Q.peso(summary.overdueTotal), `${summary.overdueCount} record${summary.overdueCount === 1 ? "" : "s"} · ${Q.pct(summary.overdueShare, 0)} of open payables`, summary.overdueCount ? "bad" : "good"),
      Q.kpi("Due in 7 days", Q.peso(summary.dueSoonTotal), `${summary.dueSoonCount} record${summary.dueSoonCount === 1 ? "" : "s"}`, summary.dueSoonCount ? "warn" : ""),
    );

    const buckets = Q.payablesAging(records);
    const maxAmount = Math.max(...buckets.map((bucket) => bucket.amount), 1);
    payablesAging.replaceChildren(...buckets.map((bucket) => {
      const row = document.createElement("div");
      row.className = "qm-aging-row";
      row.dataset.bucket = bucket.key;
      const label = document.createElement("span");
      label.textContent = bucket.label;
      const track = document.createElement("div");
      track.className = "qm-aging-track";
      const fill = document.createElement("div");
      fill.className = "qm-aging-fill";
      fill.style.width = `${(bucket.amount / maxAmount) * 100}%`;
      track.append(fill);
      const value = document.createElement("span");
      value.className = "qm-aging-value";
      value.textContent = `${Q.peso(bucket.amount)} · ${bucket.count}`;
      row.append(label, track, value);
      return row;
    }));

    const sorted = [...records].sort((left, right) => (left.dueDate || "").localeCompare(right.dueDate || ""));
    payablesEmpty.hidden = sorted.length > 0;
    payablesBody.replaceChildren(...sorted.map((expense) => {
      const row = document.createElement("tr");
      const cell = (text, className) => {
        const td = document.createElement("td");
        if (className) td.className = className;
        td.textContent = text;
        return td;
      };
      row.append(
        cell(expense.expenseId, "qm-id"),
        cell(expense.vendor),
        cell(expense.category || "-"),
        cell(expense.reference),
        cell(Q.peso(expense.amount), "qm-num"),
      );

      const due = document.createElement("td");
      due.textContent = expense.dueDate || "-";
      const hint = document.createElement("span");
      hint.className = "qm-aging-hint";
      hint.textContent = agingLabel(expense);
      due.append(hint);
      row.append(due);

      const statusCell = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = `history-status-chip ${payableChipClass(expense)}`;
      chip.textContent = expense.payableStatus || "Open";
      statusCell.append(chip);
      row.append(statusCell);

      const docCell = document.createElement("td");
      if (expense.documentName) {
        const view = document.createElement("button");
        view.type = "button";
        view.className = "qm-button qm-button-ghost qm-button-small";
        view.textContent = "View";
        view.title = expense.documentName;
        view.addEventListener("click", () => {
          Q.openDoc(expense.expenseId).then((opened) => {
            if (!opened) {
              showFeedback("info", "Document copy not available", `${expense.documentName} is recorded on this expense, but the file itself is not stored in this browser.`);
            }
          }).catch((error) => showFeedback("error", "Document could not be opened", error.message));
        });
        docCell.append(view);
      } else {
        docCell.textContent = "-";
      }
      row.append(docCell);

      const actionCell = document.createElement("td");
      if (expense.paymentRequestId) {
        actionCell.textContent = expense.paymentRequestId;
      } else if (expense.payableStatus !== "Paid") {
        const request = document.createElement("button");
        request.type = "button";
        request.className = "qm-button qm-button-small";
        request.textContent = "Create Payment Request";
        request.addEventListener("click", () => createPaymentRequest(expense.expenseId));
        actionCell.append(request);
      } else {
        actionCell.textContent = "-";
      }
      row.append(actionCell);
      return row;
    }));
  }

  renderPayables();

  form.addEventListener("submit", handleSubmit);
  confirmSaveButton.addEventListener("click", () => {
    if (pendingExpense) {
      const data = pendingExpense;
      clearDuplicateWarning();
      saveExpense(data);
    }
  });
  reviewButton.addEventListener("click", () => {
    clearDuplicateWarning();
    vendorInput.focus();
  });
  paymentRequestButton.addEventListener("click", () => createPaymentRequest());
  document.querySelector("#dismiss-expense-feedback").addEventListener("click", dismissFeedback);
}

function createExpenseId(year, records) {
  const numbers = records
    .map((record) => record.expenseId?.match(new RegExp(`^EXP-${year}-(\\d+)$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `EXP-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function createPaymentRequestId(year, requests) {
  const numbers = requests
    .map((request) => request.requestId.match(new RegExp(`^PAY-${year}-(\\d+)$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `PAY-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}