const sampleAuditEvents = [
  { at: "2026-10-20T09:14:00", user: "A. Reyes", role: "Finance Preparer", action: "Saved expense", reference: "EXP-2001", result: "Recorded", before: "", after: "Saved", type: "Expense" },
  { at: "2026-10-20T09:33:00", user: "A. Reyes", role: "Finance Preparer", action: "Submitted payment request", reference: "PR-3001", result: "Recorded", before: "Saved", after: "Pending Approval", type: "Payment Request" },
  { at: "2026-10-20T16:06:00", user: "M. Santos", role: "Approver", action: "Approved (Finance verified)", reference: "PR-3001", result: "Recorded", before: "Pending Approval", after: "Approved", type: "Approval" },
  { at: "2026-10-21T10:41:00", user: "M. Santos", role: "Approver", action: "Returned (Missing attachment)", reference: "PR-3002", result: "Recorded", before: "Pending Approval", after: "Returned for Correction", type: "Approval" },
  { at: "2026-10-22T08:30:00", user: "A. Reyes", role: "Finance Preparer", action: "Self-approval attempt blocked", reference: "PR-3003", result: "Blocked", before: "Pending Approval", after: "Pending Approval", type: "Access Control" },
  { at: "2026-10-22T17:10:00", user: "A. Reyes", role: "Finance Preparer", action: "Corrected and resubmitted", reference: "PR-3002", result: "Recorded", before: "Returned for Correction", after: "Pending Approval", type: "Payment Request" },
  { at: "2026-10-23T11:06:00", user: "R. Tan", role: "Finance Preparer", action: "Marked paid after external payment (Oct 23, 2026, ref BANK-REF-88213)", reference: "EXP-2001", result: "Recorded", before: "Payable: Open", after: "Paid", type: "External Payment" },
  { at: "2026-10-23T11:19:00", user: "A. Reyes", role: "Finance Preparer", action: "Updated invoice details", reference: "INV-1004", result: "Recorded", before: "Invoiced", after: "Invoiced", type: "Income" },
  { at: "2026-10-23T11:34:00", user: "R. Tan", role: "Finance Preparer", action: "Saved expense", reference: "EXP-2002", result: "Recorded", before: "", after: "Saved", type: "Expense" },
  { at: "2026-10-23T11:48:00", user: "M. Santos", role: "Approver", action: "Viewed payment request", reference: "PR-3003", result: "Viewed", before: "Pending Approval", after: "Pending Approval", type: "Approval" },
  { at: "2026-10-23T12:05:00", user: "A. Reyes", role: "Finance Preparer", action: "Recorded customer collection", reference: "INV-1001", result: "Recorded", before: "Partially Paid", after: "Partially Paid", type: "Income" },
  { at: "2026-10-23T12:22:00", user: "M. Santos", role: "Approver", action: "Viewed approval history", reference: "PR-3002", result: "Viewed", before: "Pending Approval", after: "Pending Approval", type: "Approval" },
  { at: "2026-10-23T12:40:00", user: "A. Reyes", role: "Finance Preparer", action: "Attached supporting document", reference: "EXP-2002", result: "Recorded", before: "Missing attachment", after: "Attached", type: "Expense" },
  { at: "2026-10-23T13:02:00", user: "M. Santos", role: "Management / Read-only", action: "Reviewed budget variance", reference: "Raw Materials", result: "Viewed", before: "Over Budget", after: "Over Budget", type: "Budget" },
  { at: "2026-10-23T13:18:00", user: "A. Reyes", role: "Finance Preparer", action: "Submitted payment request", reference: "PR-3004", result: "Recorded", before: "Saved", after: "Pending Approval", type: "Payment Request" },
  { at: "2026-10-23T13:35:00", user: "M. Santos", role: "Approver", action: "Reviewed supporting documents", reference: "PR-3004", result: "Viewed", before: "Pending Approval", after: "Pending Approval", type: "Approval" },
  { at: "2026-10-23T13:52:00", user: "A. Reyes", role: "Finance Preparer", action: "Updated expense due date", reference: "EXP-2006", result: "Recorded", before: "Nov 6, 2026", after: "Nov 8, 2026", type: "Expense" },
  { at: "2026-10-23T14:10:00", user: "M. Santos", role: "Management / Read-only", action: "Generated financial summary", reference: "2026-10", result: "Generated", before: "", after: "Summary", type: "Report" },
  { at: "2026-10-23T14:26:00", user: "A. Reyes", role: "Finance Preparer", action: "Updated invoice status", reference: "INV-1007", result: "Recorded", before: "Invoiced", after: "Overdue", type: "Income" },
  { at: "2026-10-23T14:43:00", user: "M. Santos", role: "Approver", action: "Reviewed request comments", reference: "PR-3002", result: "Viewed", before: "Pending Approval", after: "Pending Approval", type: "Approval" },
  { at: "2026-10-23T15:01:00", user: "A. Reyes", role: "Finance Preparer", action: "Saved expense", reference: "EXP-2007", result: "Recorded", before: "", after: "Saved", type: "Expense" },
  { at: "2026-10-23T15:18:00", user: "R. Tan", role: "Finance Preparer", action: "Confirmed external payment reference", reference: "BANK-REF-88213", result: "Recorded", before: "Unverified", after: "Manually recorded", type: "External Payment" },
  { at: "2026-10-23T15:36:00", user: "M. Santos", role: "Management / Read-only", action: "Reviewed low cash alert", reference: "Week 10", result: "Alert", before: "₱3,000,000 threshold", after: "₱2,950,000 closing", type: "Cash Alert" },
  { at: "2026-10-23T15:54:00", user: "A. Reyes", role: "Finance Preparer", action: "Submitted supporting document", reference: "EXP-2007", result: "Recorded", before: "Pending", after: "Attached", type: "Expense" },
];

function initializeAuditPage() {
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
    !session.permissions.includes("audit")
  ) {
    window.location.replace("login.html");
    return;
  }

  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const name = email.startsWith("management@")
    ? "Maria G. Santos"
    : email.startsWith("approver@")
      ? "David L. Cruz"
      : email.startsWith("preparer@")
        ? "Maria G. Santos"
        : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
    element.removeAttribute("href");
    element.setAttribute("aria-disabled", "true");
    element.setAttribute("tabindex", "-1");
    element.classList.add("is-unavailable");
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

  const fromInput = document.querySelector("#audit-date-from");
  const toInput = document.querySelector("#audit-date-to");
  const userSelect = document.querySelector("#audit-user");
  const actionSelect = document.querySelector("#audit-action");
  const referenceInput = document.querySelector("#audit-reference");
  const feedback = document.querySelector("#audit-feedback");
  const rowsContainer = document.querySelector("#audit-rows");
  const emptyState = document.querySelector("#audit-empty");
  const countLabel = document.querySelector("#audit-count");
  const pageNumber = document.querySelector("#audit-page-number");
  const previousButton = document.querySelector("#audit-prev");
  const nextButton = document.querySelector("#audit-next");
  const pageSize = 7;
  let allEvents = [...sampleAuditEvents];
  let currentPage = 1;
  let filteredEvents = [];

  function showAuditError(message) {
    feedback.textContent = message;
    feedback.hidden = false;
  }

  function readLocalRecords(key, label) {
    const saved = localStorage.getItem(key);
    if (saved === null) {
      return [];
    }
    const records = JSON.parse(saved);
    if (!Array.isArray(records)) {
      throw new TypeError(`${label} are not in the expected format.`);
    }
    return records;
  }

  function eventExists(reference, action, at) {
    return allEvents.some((event) =>
      event.reference === reference &&
      event.action === action &&
      event.at.slice(0, 16) === at.slice(0, 16)
    );
  }

  function loadSavedActivity() {
    try {
      const expenses = readLocalRecords("fmisExpenseRecords", "Saved expense records");
      expenses.forEach((expense) => {
        if (
          !expense ||
          typeof expense.expenseId !== "string" ||
          typeof expense.reference !== "string" ||
          typeof expense.vendor !== "string" ||
          typeof expense.date !== "string"
        ) {
          throw new TypeError("Saved expense records have an invalid format.");
        }
        const at = expense.createdAt || `${expense.date}T12:00:00`;
        if (!eventExists(expense.reference, "Saved expense", at)) {
          allEvents.push({
            at,
            user: expense.createdBy || "Finance Preparer",
            role: "Finance Preparer",
            action: "Saved expense",
            reference: expense.reference,
            result: "Recorded",
            before: "",
            after: "Saved",
            type: "Expense",
            source: "saved",
          });
        }
      });

      const requests = readLocalRecords("fmisPaymentRequests", "Saved payment requests");
      requests.forEach((request) => {
        if (!request || typeof request.requestId !== "string" || typeof request.expenseId !== "string") {
          throw new TypeError("Saved payment requests have an invalid format.");
        }
        if (!Array.isArray(request.history)) {
          return;
        }
        request.history.forEach((entry) => {
          if (!entry || typeof entry.action !== "string" || typeof entry.at !== "string") {
            throw new TypeError(`Approval history for ${request.requestId} has an invalid format.`);
          }
          const action = entry.action === "Submitted"
            ? "Submitted payment request"
            : entry.action;
          if (!eventExists(request.requestId, action, entry.at)) {
            allEvents.push({
              at: entry.at,
              user: entry.user || "Finance Preparer",
              role: entry.role || "Finance Preparer",
              action,
              reference: request.requestId,
              result: "Recorded",
              before: entry.previousStatus || "",
              after: entry.status || request.status || "Pending Approval",
              type: entry.role === "Approver" ? "Approval" : "Payment Request",
              source: "saved",
            });
          }
        });
      });
    } catch (error) {
      showAuditError(`Saved audit activity could not be fully loaded: ${error.message}`);
    }
  }

  function populateSelect(select, values, placeholder) {
    const currentValue = select.value;
    select.replaceChildren(new Option(placeholder, ""));
    [...new Set(values)].sort((left, right) => left.localeCompare(right)).forEach((value) => {
      select.add(new Option(value, value));
    });
    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  }

  function populateFilters() {
    populateSelect(userSelect, allEvents.map((event) => event.user), "All users");
    populateSelect(actionSelect, allEvents.map((event) => event.type), "All actions");
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return { date: value, time: "" };
    }
    return {
      date: new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(date),
      time: new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date),
    };
  }

  function createStatusChange(event) {
    const cell = document.createElement("td");
    cell.className = "audit-status-cell";
    if (event.result === "Blocked") {
      const unchanged = document.createElement("span");
      unchanged.className = `audit-status-chip ${statusClass(event.after)}`;
      unchanged.textContent = `No change (${event.after})`;
      cell.append(unchanged);
      return cell;
    }
    if (event.before) {
      const before = document.createElement("span");
      before.className = `audit-status-chip ${statusClass(event.before)}`;
      before.textContent = event.before;
      cell.append(before);
      if (event.before !== event.after && event.after) {
        const arrow = document.createElement("span");
        arrow.className = "audit-status-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        cell.append(arrow);
      }
    }
    if (event.after && event.before !== event.after) {
      const after = document.createElement("span");
      after.className = `audit-status-chip ${statusClass(event.after)}`;
      after.textContent = event.after;
      cell.append(after);
    }
    return cell;
  }

  function statusClass(status) {
    const normalized = status.toLowerCase();
    if (normalized.includes("pending")) return "is-pending";
    if (normalized.includes("approved") || normalized.includes("paid")) return "is-positive";
    if (normalized.includes("returned")) return "is-returned";
    if (normalized.includes("over budget") || normalized.includes("₱2,950,000")) return "is-danger";
    if (normalized.includes("overdue")) return "is-danger";
    return "is-neutral";
  }

  function createTextCell(value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) {
      cell.className = className;
    }
    return cell;
  }

  function createEventRow(event) {
    const row = document.createElement("tr");
    if (event.result === "Blocked") {
      row.classList.add("is-blocked");
    }
    const timestamp = formatTimestamp(event.at);
    const timeCell = document.createElement("td");
    timeCell.className = "audit-timestamp";
    const dateText = document.createElement("span");
    dateText.textContent = timestamp.date;
    const timeText = document.createElement("small");
    timeText.textContent = timestamp.time;
    timeCell.append(dateText, timeText);
    row.append(
      timeCell,
      createTextCell(event.user),
      createTextCell(event.role),
      createTextCell(event.action, "audit-action-cell"),
      createTextCell(event.reference, "audit-reference-cell"),
    );
    const resultCell = createTextCell("", "audit-result-cell");
    const result = document.createElement("span");
    result.className = `audit-result-chip ${event.result === "Blocked" ? "is-blocked" : "is-recorded"}`;
    result.textContent = event.result;
    resultCell.append(result);
    row.append(resultCell, createStatusChange(event));
    return row;
  }

  function applyFilters() {
    const from = fromInput.value;
    const to = toInput.value;
    if (from && to && from > to) {
      showAuditError("Start date must be on or before the end date.");
      fromInput.focus();
      return;
    }

    feedback.hidden = true;
    filteredEvents = allEvents
      .filter((event) => {
        const date = event.at.slice(0, 10);
        const matchesDate = (!from || date >= from) && (!to || date <= to);
        const matchesUser = !userSelect.value || event.user === userSelect.value;
        const matchesAction = !actionSelect.value || event.type === actionSelect.value;
        const query = referenceInput.value.trim().toLowerCase();
        const matchesReference = !query ||
          event.reference.toLowerCase().includes(query) ||
          event.action.toLowerCase().includes(query);
        return matchesDate && matchesUser && matchesAction && matchesReference;
      })
      .sort((left, right) => left.at.localeCompare(right.at) || left.reference.localeCompare(right.reference));
    currentPage = 1;
    renderEvents();
  }

  function renderEvents() {
    const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * pageSize;
    const pageEvents = filteredEvents.slice(start, start + pageSize);
    rowsContainer.replaceChildren(...pageEvents.map(createEventRow));
    emptyState.hidden = filteredEvents.length > 0;
    const rangeStart = filteredEvents.length ? start + 1 : 0;
    const rangeEnd = Math.min(start + pageSize, filteredEvents.length);
    countLabel.textContent = `Showing ${rangeStart}–${rangeEnd} of ${filteredEvents.length}`;
    pageNumber.textContent = String(currentPage);
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pageCount;
  }

  document.querySelector("#audit-filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  document.querySelector("#audit-filter-form").addEventListener("reset", (event) => {
    event.preventDefault();
    fromInput.value = "";
    toInput.value = "";
    userSelect.value = "";
    actionSelect.value = "";
    referenceInput.value = "";
    feedback.hidden = true;
    applyFilters();
  });
  previousButton.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderEvents();
    }
  });
  nextButton.addEventListener("click", () => {
    if (currentPage < Math.ceil(filteredEvents.length / pageSize)) {
      currentPage += 1;
      renderEvents();
    }
  });
  document.querySelectorAll("[data-audit-search]").forEach((button) => {
    button.addEventListener("click", () => {
      fromInput.value = "";
      toInput.value = "";
      userSelect.value = "";
      actionSelect.value = "";
      referenceInput.value = button.dataset.auditSearch;
      applyFilters();
      document.querySelector("#audit-log").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  loadSavedActivity();
  populateFilters();
  applyFilters();
}

initializeAuditPage();