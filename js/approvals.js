const approvalRequestsKey = "fmisPaymentRequests";
const approvalExpensesKey = "fmisExpenseRecords";

function getApprovalSession() {
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
    !session.permissions.includes("approvals")
  ) {
    window.location.replace("login.html");
    return null;
  }

  return session;
}

const approvalSession = getApprovalSession();

if (approvalSession) {
  initializeApprovals(approvalSession);
}

function initializeApprovals(session) {
  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const isApprover = session.role === "Approver";
  const actorName = email === "approver@fmis.example"
    ? "David L. Cruz"
    : email.startsWith("management@")
      ? "Maria G. Santos"
      : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const initials = actorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  document.querySelector("#profile-name").textContent = actorName;
  document.querySelector("#profile-role").textContent = session.role;
  document.querySelector("#sidebar-user-name").textContent = session.role;
  document.querySelector("#approval-actor-name").textContent = actorName;
  document.querySelector("#approval-role-label").textContent = isApprover ? "Authorized Approver" : session.role;
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

  const requestSelect = document.querySelector("#approval-request-select");
  const feedback = document.querySelector("#approval-feedback");
  const historyBody = document.querySelector("#approval-history-rows");
  const historyEmpty = document.querySelector("#approval-history-empty");
  const decisionComment = document.querySelector("#approval-comment");
  const approveButton = document.querySelector("#approve-request");
  const rejectButton = document.querySelector("#reject-request");
  const returnButton = document.querySelector("#return-request");
  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let requests = [];
  let expenses = [];
  let storageReady = true;
  let currentRequest = null;

  function showFeedback(message, isError = false) {
    feedback.textContent = message;
    feedback.dataset.state = isError ? "error" : "success";
    feedback.hidden = false;
  }

  function loadRecords(key, validator, label) {
    const saved = localStorage.getItem(key);
    if (saved === null) {
      return [];
    }
    const records = JSON.parse(saved);
    if (!Array.isArray(records) || records.some((record) => !validator(record))) {
      throw new TypeError(`${label} have an invalid format.`);
    }
    return records;
  }

  function isValidRequest(request) {
    return request &&
      typeof request.requestId === "string" &&
      typeof request.expenseId === "string" &&
      typeof request.status === "string";
  }

  function isValidExpense(expense) {
    return expense &&
      typeof expense.expenseId === "string" &&
      typeof expense.vendor === "string" &&
      typeof expense.reference === "string" &&
      typeof expense.amount === "number";
  }

  function seedIllustrativeRequest() {
    const request = {
      requestId: "PR-2026-00012",
      expenseId: "EXP-2026-00031",
      status: "Pending Approval",
      vendor: "FreshFarm Supplies",
      amount: 12450,
      category: "Raw Materials",
      dueDate: "2026-11-28",
      reference: "INV-2026-88214",
      documentName: "invoice_oct20.pdf",
      requestedDate: "2026-11-14",
      comments: "Urgent supplier payment for October raw-material deliveries.",
      preparedBy: "Maria G. Santos",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-11-14T06:32:00.000Z",
      history: [
        {
          at: "2026-11-14T06:32:00.000Z",
          user: "Maria G. Santos",
          role: "Finance Preparer",
          action: "Submitted",
          status: "Pending Approval",
          comments: "Request created and submitted for approval.",
        },
      ],
      illustrative: true,
    };
    const expense = {
      expenseId: request.expenseId,
      transactionId: request.expenseId,
      date: "2026-11-14",
      vendor: request.vendor,
      amount: request.amount,
      category: request.category,
      dueDate: request.dueDate,
      reference: request.reference,
      documentName: request.documentName,
      payableStatus: "Payment Requested",
      paymentRequestId: request.requestId,
      illustrative: true,
    };
    requests = [request];
    expenses = [expense];
    document.querySelector("#approval-action-note").textContent =
      "Illustrative request for demonstration. Decisions change its status and history only; no money is transferred.";
  }

  try {
    requests = loadRecords(approvalRequestsKey, isValidRequest, "Saved payment requests");
    expenses = loadRecords(approvalExpensesKey, isValidExpense, "Saved expense records");
    if (!requests.length && localStorage.getItem(approvalRequestsKey) === null) {
      seedIllustrativeRequest();
    }
  } catch (error) {
    storageReady = false;
    showFeedback(`Approval data could not be loaded: ${error.message}`, true);
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "—";
    }
    const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.valueOf())) {
      return dateString;
    }
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatDateTime(dateString) {
    if (!dateString) {
      return "—";
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) {
      return formatDate(dateString);
    }
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function relatedExpense(request) {
    return expenses.find((expense) => expense.expenseId === request.expenseId) || null;
  }

  function displayValue(elementId, value) {
    document.querySelector(`#${elementId}`).textContent =
      value === null || value === undefined || value === "" ? "—" : String(value);
  }

  function displayStatus(status) {
    return status === "Submitted" ? "Pending Approval" : status || "Pending Approval";
  }

  function populateRequestSelect() {
    requestSelect.replaceChildren();
    if (!requests.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No payment requests available";
      requestSelect.append(option);
      currentRequest = null;
      renderRequest();
      return;
    }

    requests
      .slice()
      .sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")))
      .forEach((request) => {
        const option = document.createElement("option");
        option.value = request.requestId;
        option.textContent = `${request.requestId} · ${request.vendor || relatedExpense(request)?.vendor || "Vendor"} · ${displayStatus(request.status)}`;
        requestSelect.append(option);
      });

    const pending = requests.find((request) => ["Pending Approval", "Submitted"].includes(request.status));
    requestSelect.value = (pending || requests[0]).requestId;
    currentRequest = requests.find((request) => request.requestId === requestSelect.value) || null;
    renderRequest();
  }

  function renderRequest() {
    if (!currentRequest) {
      [
        "detail-request-id",
        "detail-expense-id",
        "detail-vendor",
        "detail-category",
        "detail-amount",
        "detail-due-date",
        "detail-document",
        "detail-requested-date",
        "detail-comments",
        "detail-prepared-by",
        "detail-submitted-date",
      ].forEach((id) => displayValue(id, "—"));
      displayStatusChips("No Request");
      renderHistory([]);
      setDecisionAvailability(false);
      document.querySelector("#approval-caution-text").textContent = "There are no submitted payment requests to review.";
      return;
    }

    const expense = relatedExpense(currentRequest);
    const status = displayStatus(currentRequest.status);
    displayValue("detail-request-id", currentRequest.requestId);
    displayValue("detail-expense-id", currentRequest.expenseId);
    displayValue("detail-vendor", currentRequest.vendor || expense?.vendor);
    displayValue("detail-category", currentRequest.category || expense?.category);
    displayValue("detail-amount", `₱${moneyFormat.format(Number(currentRequest.amount ?? expense?.amount) || 0)}`);
    displayValue("detail-due-date", formatDate(currentRequest.dueDate || expense?.dueDate));
    displayValue("detail-document", currentRequest.documentName || expense?.documentName || "No document attached");
    displayValue("detail-requested-date", formatDate(currentRequest.requestedDate || currentRequest.createdAt || currentRequest.submittedAt));
    displayValue("detail-comments", currentRequest.comments || "No comments provided.");
    displayValue("detail-prepared-by", currentRequest.preparedBy || currentRequest.createdBy || "Finance Preparer");
    displayValue("detail-submitted-date", formatDateTime(currentRequest.submittedAt || currentRequest.createdAt));
    document.querySelector("#detail-prepared-role").textContent = currentRequest.preparedRole || "Finance Preparer";
    document.querySelector("#document-availability").textContent =
      currentRequest.documentName || expense?.documentName
        ? "(metadata only; file is not stored)"
        : "";
    displayStatusChips(status);
    const requestHistory = Array.isArray(currentRequest.history) && currentRequest.history.length
      ? currentRequest.history
      : [{
        at: currentRequest.submittedAt || currentRequest.createdAt,
        user: currentRequest.preparedBy || currentRequest.createdBy || "Finance Preparer",
        role: currentRequest.preparedRole || "Finance Preparer",
        action: "Submitted",
        status: "Pending Approval",
        comments: "Request created and submitted for approval.",
      }];
    renderHistory(requestHistory);
    const isIndependent = !currentRequest.preparedByEmail ||
      currentRequest.preparedByEmail.toLowerCase() !== email;
    setDecisionAvailability(isApprover && isIndependent && storageReady && status === "Pending Approval");

    const caution = document.querySelector("#approval-caution-text");
    if (status === "Pending Approval") {
      caution.textContent = "This request is pending approval. Review the linked expense and supporting evidence before deciding. Approval does not transfer money.";
    } else {
      caution.textContent = `This request is ${status.toLowerCase()}. Its decision is recorded; no money is transferred by the prototype.`;
    }
  }

  function displayStatusChips(status) {
    const detailChip = document.querySelector("#detail-status");
    const sideChip = document.querySelector("#side-status");
    [detailChip, sideChip].forEach((chip) => {
      chip.textContent = status;
      chip.dataset.status = status.toLowerCase().replace(/[^a-z]+/g, "-");
    });
    document.querySelector("#side-status-description").textContent =
      status === "Pending Approval"
        ? "Waiting for approver decision."
        : status === "Approved"
          ? "Approved. No payment has been made."
          : status === "Rejected"
            ? "Rejected. No payment has been made."
            : status === "Returned for Correction"
              ? "Returned to the preparer for correction."
              : "No request is currently selected.";
  }

  function renderHistory(history) {
    historyBody.replaceChildren();
    historyEmpty.hidden = history.length > 0;
    history.forEach((entry, index) => {
      const row = document.createElement("tr");
      const values = [
        String(index + 1),
        formatDateTime(entry.at || entry.date),
        entry.user || "—",
        entry.role || "—",
        entry.action || "—",
        displayStatus(entry.status),
        entry.comments || "—",
      ];
      values.forEach((value, valueIndex) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (valueIndex === 5) {
          const chip = document.createElement("span");
          chip.className = "approval-history-status";
          chip.dataset.status = value.toLowerCase().replace(/[^a-z]+/g, "-");
          chip.textContent = value;
          cell.replaceChildren(chip);
        }
        row.append(cell);
      });
      historyBody.append(row);
    });
  }

  function setDecisionAvailability(available) {
    [approveButton, rejectButton, returnButton].forEach((button) => {
      button.disabled = !available;
    });
    decisionComment.disabled = !isApprover || !storageReady || !currentRequest || !available;
    document.querySelector("#approval-role-notice").classList.toggle("is-read-only", !isApprover);
  }

  function persistDecision(action, nextStatus) {
    if (!isApprover) {
      showFeedback("Only an authorized Approver may record a decision.", true);
      return;
    }
    if (!storageReady || !currentRequest) {
      showFeedback("Approval data is unavailable. No decision was recorded.", true);
      return;
    }
    if (currentRequest.preparedByEmail && currentRequest.preparedByEmail.toLowerCase() === email) {
      showFeedback("You cannot decide a request you prepared.", true);
      return;
    }
    if (displayStatus(currentRequest.status) !== "Pending Approval") {
      showFeedback("This request has already been decided and cannot be changed here.", true);
      return;
    }

    const comments = decisionComment.value.trim();
    if ((action === "Rejected" || action === "Returned for Correction") && !comments) {
      decisionComment.setCustomValidity("Add a comment explaining this decision.");
      decisionComment.reportValidity();
      decisionComment.focus();
      showFeedback("Comments are required when rejecting or returning a request.", true);
      return;
    }
    decisionComment.setCustomValidity("");

    const requestIndex = requests.findIndex((request) => request.requestId === currentRequest.requestId);
    if (requestIndex < 0) {
      showFeedback("The selected request could not be found. No decision was recorded.", true);
      return;
    }

    const previousRequest = { ...currentRequest };
    const previousHistory = Array.isArray(currentRequest.history) && currentRequest.history.length
      ? currentRequest.history
      : [{
        at: currentRequest.submittedAt || currentRequest.createdAt,
        user: currentRequest.preparedBy || currentRequest.createdBy || "Finance Preparer",
        role: currentRequest.preparedRole || "Finance Preparer",
        action: "Submitted",
        status: "Pending Approval",
        comments: "Request created and submitted for approval.",
      }];
    const updatedRequest = {
      ...currentRequest,
      status: nextStatus,
      decidedAt: new Date().toISOString(),
      decidedBy: actorName,
      decidedByRole: "Approver",
      history: [
        ...previousHistory,
        {
          at: new Date().toISOString(),
          user: actorName,
          role: "Approver",
          action,
          status: nextStatus,
          comments: comments || (action === "Approved" ? "Approved after review." : ""),
        },
      ],
    };
    requests[requestIndex] = updatedRequest;

    let previousRequestsStorage;
    let previousExpensesStorage;
    try {
      previousRequestsStorage = localStorage.getItem(approvalRequestsKey);
      if (currentRequest.illustrative) {
        previousExpensesStorage = localStorage.getItem(approvalExpensesKey);
      }
      localStorage.setItem(approvalRequestsKey, JSON.stringify(requests));
      if (currentRequest.illustrative) {
        localStorage.setItem(approvalExpensesKey, JSON.stringify(expenses));
      }
    } catch (error) {
      requests[requestIndex] = previousRequest;
      try {
        if (previousRequestsStorage === null) {
          localStorage.removeItem(approvalRequestsKey);
        } else if (previousRequestsStorage !== undefined) {
          localStorage.setItem(approvalRequestsKey, previousRequestsStorage);
        }
        if (currentRequest.illustrative) {
          if (previousExpensesStorage === null) {
            localStorage.removeItem(approvalExpensesKey);
          } else if (previousExpensesStorage !== undefined) {
            localStorage.setItem(approvalExpensesKey, previousExpensesStorage);
          }
        }
      } catch (rollbackError) {
        showFeedback(`The decision could not be saved: ${error.message}. Previous data could not be restored: ${rollbackError.message}`, true);
        return;
      }
      showFeedback(`The decision could not be saved: ${error.message}`, true);
      return;
    }

    currentRequest = updatedRequest;
    decisionComment.value = "";
    populateRequestSelect();
    requestSelect.value = updatedRequest.requestId;
    currentRequest = updatedRequest;
    renderRequest();
    showFeedback(`${action} recorded for ${updatedRequest.requestId}. No money was transferred.`);
  }

  requestSelect.addEventListener("change", () => {
    currentRequest = requests.find((request) => request.requestId === requestSelect.value) || null;
    feedback.hidden = true;
    decisionComment.value = "";
    renderRequest();
  });
  approveButton.addEventListener("click", () => persistDecision("Approved", "Approved"));
  rejectButton.addEventListener("click", () => persistDecision("Rejected", "Rejected"));
  returnButton.addEventListener("click", () => persistDecision("Returned for Correction", "Returned for Correction"));

  if (!isApprover) {
    const notice = document.querySelector("#approval-role-notice");
    const text = document.createElement("p");
    text.append("Read-only review. Decisions are restricted to an authorized Approver. Signed in as ");
    const actor = document.createElement("strong");
    actor.textContent = actorName;
    text.append(actor, ".");
    notice.replaceChildren(Object.assign(document.createElement("span"), {
      textContent: "i",
      ariaHidden: "true",
    }), text);
  }

  populateRequestSelect();
}