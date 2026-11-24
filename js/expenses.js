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
  const fullName = window.FMIS.getDisplayName(session);
  const initials = window.FMIS.getInitials(fullName);
  const canEdit = session.role === "Finance Preparer";
  const approverSelect = document.querySelector("#assigned-approver");
  approverSelect.replaceChildren(...window.FMISAccounts.listApprovers()
    .map(({ fullName, email }) => new Option(fullName, email)));
  approverSelect.disabled = !canEdit;

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
  let editingExpenseId = null;
  let savingExpense = false;
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
      editingExpenseId = null;
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
    if (!data.document || data.document.size === 0) {
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

    if (!canEdit || savingExpense) return;
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

    if (!editingExpenseId && findPossibleDuplicate(data)) {
      pendingExpense = data;
      warning.hidden = false;
      return;
    }
    saveExpense(data);
  }

  async function saveExpense(data) {
    if (!canEdit || savingExpense) return;
    savingExpense = true;
    try {
      await storeExpense(data);
    } catch (error) {
      showFeedback("error", "Expense could not be saved", error.message);
    } finally {
      savingExpense = false;
    }
  }

  async function storeExpense(data) {
    records = readRecords();
    const previous = records.find((record) => record.expenseId === editingExpenseId);
    const returned = previous && readPaymentRequests().find((request) =>
      request.requestId === previous.paymentRequestId && request.status === "Returned for Correction");
    if (editingExpenseId && (!previous || (previous.paymentRequestId && !returned) || previous.payableStatus === "Paid")) {
      throw new Error("This payable is no longer available for correction.");
    }
    const expenseId = previous?.expenseId || createExpenseId(data.date.slice(0, 4), records);
    const currentReference = data.reference.toLowerCase();
    if (records.some((record) => record.expenseId !== expenseId && record.reference.trim().toLowerCase() === currentReference)) {
      clearDuplicateWarning();
      setFieldError("reference", "This reference / invoice number already exists.");
      showFeedback("error", "Duplicate invoice reference", "Use a unique reference / invoice number for each expense.");
      referenceInput.focus();
      return;
    }

    const documentKey = crypto.randomUUID();
    await window.FMISQM.saveDoc(documentKey, data.document);
    records = readRecords();
    if (records.some((record) => record.expenseId !== expenseId && record.reference.trim().toLowerCase() === currentReference) ||
        (!previous && records.some((record) => record.expenseId === expenseId)) ||
        (previous && ((returned && !readPaymentRequests().some((request) => request.requestId === returned.requestId &&
          request.status === returned.status && request.decidedAt === returned.decidedAt)) ||
          !records.some((record) => record.expenseId === expenseId && record.documentKey === previous.documentKey &&
            record.paymentRequestId === previous.paymentRequestId && record.payableStatus === previous.payableStatus)))) {
      throw new Error("The payable changed while its attachment was saved. Review the latest entry and try again.");
    }
    const newRecord = {
      expenseId,
      transactionId: expenseId,
      date: data.date,
      vendor: data.vendor,
      amount: data.amount,
      category: data.category,
      dueDate: data.dueDate,
      reference: data.reference,
      documentKey,
      documentName: data.document.name,
      documentSize: data.document.size,
      createdAt: new Date().toISOString(),
      createdBy: window.FMIS.getDisplayName(session),
      createdByEmail: session.email,
      createdByRole: session.role,
      payableStatus: returned ? "Payment Requested" : "Open",
      paymentRequestId: previous?.paymentRequestId || null,
    };

    let previousRecords;
    try {
      previousRecords = localStorage.getItem(expenseRecordsKey);
      records = [newRecord, ...records.filter((record) => record.expenseId !== expenseId)];
      localStorage.setItem(expenseRecordsKey, JSON.stringify(records));
      if (window.FMIS) window.FMIS.logActivity({
        action: previous ? "Corrected returned expense" : "Saved expense",
        reference: data.reference,
        before: "",
        after: `Saved; ₱${data.amount.toFixed(2)}`,
        type: "Expense",
        description: `Saved expense ${data.reference} for ${data.vendor}; amount ₱${data.amount.toFixed(2)}.`,
      });
    } catch (error) {
      records = previousRecords ? JSON.parse(previousRecords) : [];
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

    lastSavedExpenseId = expenseId;
    paymentRequestButton.disabled = Boolean(returned);
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

  async function createPaymentRequest(targetExpenseId) {
    try {
      await submitPaymentRequest(targetExpenseId);
    } catch (error) {
      showFeedback("error", "Payment request could not be created", error.message);
    }
  }

  async function submitPaymentRequest(targetExpenseId) {
    if (!canEdit) return;
    const expenseKey = targetExpenseId || lastSavedExpenseId;
    if (!expenseKey) {
      showFeedback("error", "Payment request unavailable", "Save an expense first. Payment requests are a separate step.");
      return;
    }
    records = readRecords();
    let expense = records.find((record) => record.expenseId === expenseKey);
    if (!expense || expense.payableStatus === "Paid") {
      showFeedback("error", "Open payable record not found", "The saved expense could not be located. Refresh the Expenses page and try again.");
      return;
    }
    if (expense.paymentRequestId) {
      showFeedback("info", "Payment request already created", `Request ID: ${expense.paymentRequestId}`);
      return;
    }

    if (!(await window.FMISQM.getDoc(expense.documentKey || expense.expenseId))?.blob) {
      throw new Error("Attach supporting evidence to an expense before submitting a payment request.");
    }
    const documentKey = expense.documentKey;
    records = readRecords();
    expense = records.find((record) => record.expenseId === expenseKey);
    if (!expense || expense.documentKey !== documentKey || expense.paymentRequestId || expense.payableStatus === "Paid") {
      throw new Error("The payable changed. Reload the page before submitting.");
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
      preparedBy: window.FMIS.getDisplayName(session),
      preparedByEmail: session.email,
      assignedApproverEmail: approverSelect.value,
      preparedRole: session.role,
      submittedAt: new Date().toISOString(),
      history: [{
        at: new Date().toISOString(),
        user: window.FMIS.getDisplayName(session),
        account: session.email,
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
        description: `Submitted payment request ${requestId} for ${expense.reference}.`,
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

  const actionDialog = document.querySelector("#payable-action-dialog");
  const actionForm = document.querySelector("#payable-action-form");
  const actionError = document.querySelector("#payable-action-error");
  let activePayableAction;
  document.querySelector("#cancel-payable-action").addEventListener("click", () => actionDialog.close());

  function editExpense(expense, request) {
    form.reset();
    window.setTimeout(() => {
      editingExpenseId = expense.expenseId;
      dateInput.value = expense.date;
      updateDueDateConstraint();
      dueDateInput.value = expense.dueDate;
      vendorInput.value = expense.vendor;
      referenceInput.value = expense.reference;
      form.elements.amount.value = expense.amount;
      form.elements.category.value = expense.category;
      paymentRequestButton.disabled = true;
      const instructions = request
        ? `${request.history?.at(-1)?.comments || request.comments || ""} Attach the corrected evidence and save.`
        : "Update the open expense and attach its supporting evidence before submitting a request.";
      showFeedback("info", "Edit expense", instructions);
      vendorInput.focus();
    }, 0);
  }

  function openPayableAction(expense, request, recordingPayment) {
    actionForm.reset();
    activePayableAction = { expenseId: expense.expenseId, requestId: request.requestId, recordingPayment };
    actionError.textContent = "";
    document.querySelector("#payable-action-title").textContent = recordingPayment
      ? "Record External Payment" : "Resubmit Payment Request";
    document.querySelector("#payable-action-note").textContent = recordingPayment
      ? `Record the completed external payment of ₱${moneyFormat.format(expense.amount)}.`
      : "The corrected expense and attachment will go back to the approver.";
    const { paymentDate, bankReference } = actionForm.elements;
    paymentDate.required = bankReference.required = recordingPayment;
    paymentDate.disabled = bankReference.disabled = !recordingPayment;
    document.querySelector("#payment-date-label").hidden = !recordingPayment;
    document.querySelector("#payment-reference-label").hidden = !recordingPayment;
    paymentDate.min = (request.decidedAt ? formatDateValue(new Date(request.decidedAt)) : request.requestedDate) || expense.date;
    paymentDate.max = paymentDate.value = window.FMIS.todayDate();
    actionDialog.showModal();
  }

  actionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canEdit || !activePayableAction) return;
    const { expenseId, requestId, recordingPayment } = activePayableAction;
    const submit = actionForm.querySelector('[type="submit"]');
    submit.disabled = true;
    actionError.textContent = "";
    try {
      let currentExpenses = readRecords();
      let currentRequests = readPaymentRequests();
      let expense = currentExpenses.find((item) => item.expenseId === expenseId);
      let request = currentRequests.find((item) => item.requestId === requestId && item.expenseId === expenseId);
      const expected = recordingPayment ? "Approved" : "Returned for Correction";
      if (!expense || request?.status !== expected || expense.payableStatus === "Paid") {
        throw new Error("This payable changed. Reload the page and review its current status.");
      }
      const timestamp = new Date().toISOString();
      const action = recordingPayment ? "Recorded external payment" : "Resubmitted payment request";
      let nextStatus;
      let description;
      if (recordingPayment) {
        const bankReference = actionForm.elements.bankReference.value.trim();
        const paidDate = actionForm.elements.paymentDate.value;
        if (!bankReference || !actionForm.reportValidity()) throw new Error("Enter a valid payment date and bank reference.");
        if (currentExpenses.some((item) => item.bankReference?.toLowerCase() === bankReference.toLowerCase())) {
          throw new Error("This bank reference has already been recorded.");
        }
        Object.assign(expense, { payableStatus: "Paid", bankReference, paidDate, paidBy: session.email });
        nextStatus = "Paid";
        description = `Payment for ${expense.reference} recorded on ${paidDate}, bank reference ${bankReference}.`;
      } else {
        const correctedAt = expense.createdAt;
        const documentKey = expense.documentKey;
        if (!correctedAt || correctedAt <= request.decidedAt || !documentKey ||
            !(await window.FMISQM.getDoc(documentKey))?.blob) {
          throw new Error("Save a correction with a supporting attachment before resubmitting.");
        }
        currentExpenses = readRecords();
        currentRequests = readPaymentRequests();
        expense = currentExpenses.find((item) => item.expenseId === expenseId);
        request = currentRequests.find((item) => item.requestId === requestId);
        if (request?.status !== expected || expense?.documentKey !== documentKey || correctedAt <= request.decidedAt) {
          throw new Error("The correction changed. Review the latest request.");
        }
        nextStatus = "Pending Approval";
        description = `Corrected expense ${expense.reference} submitted for review.`;
        Object.assign(request, {
          status: nextStatus, vendor: expense.vendor, amount: expense.amount, category: expense.category,
          dueDate: expense.dueDate, reference: expense.reference, documentName: expense.documentName,
          submittedAt: timestamp, requestedDate: window.FMIS.todayDate(), comments: description,
          preparedBy: window.FMIS.getDisplayName(session), preparedByEmail: session.email, preparedRole: session.role,
          decidedAt: null, decidedBy: null, decidedByRole: null,
          history: [...(request.history || []), {
            at: timestamp, user: window.FMIS.getDisplayName(session), account: session.email,
            role: session.role, action: "Resubmitted", status: nextStatus, comments: description,
          }],
        });
      }
      const key = recordingPayment ? expenseRecordsKey : paymentRequestsKey;
      const before = localStorage.getItem(key);
      localStorage.setItem(key, JSON.stringify(recordingPayment ? currentExpenses : currentRequests));
      try {
        window.FMIS.logActivity({ action, reference: requestId, before: expected, after: nextStatus, description, type: "Payment Request" });
      } catch (error) {
        localStorage.setItem(key, before);
        throw error;
      }
      records = currentExpenses;
      actionDialog.close();
      renderPayables();
      showFeedback("success", action, description);
    } catch (error) {
      actionError.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  function renderPayables() {
    if (!payablesBody || !window.FMISQM) {
      return;
    }
    const Q = window.FMISQM;
    const requests = window.FMIS.read(paymentRequestsKey, []);
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
          Q.openDoc(expense.documentKey || expense.expenseId).then((opened) => {
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
      const linked = requests.find((request) => request.requestId === expense.paymentRequestId);
      if (expense.payableStatus === "Paid") {
        actionCell.textContent = expense.bankReference ? `Paid ${expense.paidDate} · ${expense.bankReference}` : "Paid";
      } else if (linked) {
        actionCell.textContent = `${linked.requestId} · ${linked.status}`;
        const addAction = (label, handler) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "qm-button qm-button-small";
          button.textContent = label;
          button.addEventListener("click", handler);
          actionCell.append(button);
        };
        if (canEdit && linked.status === "Returned for Correction") {
          addAction("Correct Expense", () => editExpense(expense, linked));
          if (expense.documentKey && expense.createdAt > linked.decidedAt) {
            addAction("Resubmit Request", () => openPayableAction(expense, linked, false));
          }
        }
        if (canEdit && linked.status === "Approved") {
          addAction("Record External Payment", () => openPayableAction(expense, linked, true));
        }
      } else if (canEdit && !expense.paymentRequestId) {
        const request = document.createElement("button");
        request.type = "button";
        request.className = "qm-button qm-button-small";
        request.textContent = "Create Payment Request";
        request.addEventListener("click", () => createPaymentRequest(expense.expenseId));
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "qm-button qm-button-small";
        edit.textContent = "Edit Expense";
        edit.addEventListener("click", () => editExpense(expense, null));
        actionCell.append(edit, request);
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
    .map((request) => request.requestId.match(new RegExp(`^REQ-${year}-(\\d+)$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `REQ-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}