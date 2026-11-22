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
  let allEvents = [];
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
      typeof event.at === "string" &&
      typeof at === "string" &&
      event.at.slice(0, 16) === at.slice(0, 16)
    );
  }

  function loadSavedActivity() {
    try {
      const sampleEvents = [
        { at: "2026-10-20T08:14:00", user: "A. Reyes", account: "a.reyes@swiftfoods.ph", role: "Finance Preparer", action: "Saved expense", module: "Expense", description: "Saved expense", reference: "EXP-2001", result: "Recorded", before: "", after: "Saved", type: "Expense", source: "sample" },
        { at: "2026-10-20T09:32:00", user: "A. Reyes", account: "a.reyes@swiftfoods.ph", role: "Finance Preparer", action: "Submitted payment request", module: "Payment Request", description: "Submitted payment request", reference: "PR-3001", result: "Recorded", before: "Saved", after: "Pending Approval", type: "Payment Request", source: "sample" },
        { at: "2026-10-20T10:00:00", user: "M. Santos", account: "m.santos@swiftfoods.ph", role: "Approver", action: "Approved", module: "Approval", description: "Finance verified", reference: "PR-3001", result: "Recorded", before: "Pending Approval", after: "Approved", type: "Approval", source: "sample" },
        { at: "2026-10-21T10:41:00", user: "M. Santos", account: "m.santos@swiftfoods.ph", role: "Approver", action: "Returned", module: "Approval", description: "Missing attachment", reference: "PR-3002", result: "Recorded", before: "Pending Approval", after: "Returned for Correction", type: "Approval", source: "sample" },
        { at: "2026-10-22T08:30:00", user: "A. Reyes", account: "a.reyes@swiftfoods.ph", role: "Finance Preparer", action: "Self-approval attempt blocked", module: "Payment Request", description: "Self-approval attempt blocked", reference: "PR-3003", result: "Blocked", before: "Pending Approval", after: "Pending Approval", type: "Payment Request", source: "sample" },
        { at: "2026-10-22T17:10:00", user: "A. Reyes", account: "a.reyes@swiftfoods.ph", role: "Finance Preparer", action: "Corrected and resubmitted", module: "Payment Request", description: "Corrected and resubmitted", reference: "PR-3002", result: "Recorded", before: "Returned for Correction", after: "Pending Approval", type: "Payment Request", source: "sample" },
        { at: "2026-10-23T11:06:00", user: "R. Tan", account: "r.tan@swiftfoods.ph", role: "Finance Preparer", action: "Marked paid after external payment", module: "Expense", description: "Marked paid after external payment (Oct 23, 2026); ref: BANK-REF-982131", reference: "EXP-2001", result: "Recorded", before: "Payable: Open", after: "Paid", type: "Expense", source: "sample" },
      ];
      sampleEvents.forEach((event) => {
        if (!eventExists(event.reference, event.action, event.at)) {
          allEvents.push(event);
        }
      });
      if (window.FMIS) {
        const liveEvents = window.FMIS.read(window.FMIS.keys.audit, []);
        liveEvents.forEach((event) => {
          if (!eventExists(event.reference, event.action, event.at)) {
            allEvents.unshift(event);
          }
        });
      }
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
            user: expense.createdBy || "Unknown user",
            account: expense.createdByEmail || "",
            role: expense.createdByRole || "Unknown role",
            action: "Saved expense",
            module: "Expense",
            description: `Saved expense for ${expense.vendor}`,
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
              user: entry.user || "Unknown user",
              account: entry.account || request.preparedByEmail || "",
              role: entry.role || "Unknown role",
              action,
              module: entry.role === "Approver" ? "Approval" : "Payment Request",
              description: entry.comments || `${action} · ${entry.status || request.status || "Pending Approval"}`,
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

  function renderNotifications() {
    const alertGrid = document.querySelector("#audit-alerts");
    const emptyAlert = document.querySelector("#audit-alert-empty");
    const notificationCount = document.querySelector(".notification-count");
    const alerts = [];

    try {
      const requests = readLocalRecords("fmisPaymentRequests", "Saved payment requests");
      const pendingRequests = requests.length
        ? requests.filter((request) =>
        String(request.status || "").toLowerCase().includes("pending")
          )
        : [{ requestId: "PR-3001" }, { requestId: "PR-3002" }];
      if (pendingRequests.length) {
        const request = pendingRequests[0];
        alerts.push({
          tone: "is-warning",
          audience: "For: Approver",
          message: `${pendingRequests.length} payment request${pendingRequests.length === 1 ? "" : "s"} awaiting approval. Latest: ${request.requestId}.`,
          search: request.requestId,
        });
      }

      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const expenses = readLocalRecords("fmisExpenseRecords", "Saved expense records");
      const overdueExpenses = expenses.length
        ? expenses.filter((expense) =>
          expense.payableStatus !== "Paid" &&
          typeof expense.dueDate === "string" &&
          expense.dueDate < todayValue
        )
        : [{ reference: "EXP-2003" }];
      if (overdueExpenses.length) {
        const expense = overdueExpenses[0];
        alerts.push({
          tone: "is-danger",
          audience: "For: Finance",
          message: `${overdueExpenses.length} unpaid expense${overdueExpenses.length === 1 ? "" : "s"} past due. Latest: ${expense.reference}.`,
          search: expense.reference,
        });
      }

      const lowWeeks = window.FMIS.getCashForecast().filter((week) => week.low);
      if (lowWeeks.length) {
        const week = lowWeeks[0];
        alerts.push({
          tone: "is-danger",
          audience: "For: Management",
          message: `Projected cash falls below ₱3,000,000 in Week ${week.week} (${window.FMIS.money(week.closing)}).`,
          destination: "cashforecast.html",
        });
      }
    } catch (error) {
      showAuditError(`Notifications could not be loaded: ${error.message}`);
    }

    const cards = alerts.map((alert) => {
      const card = document.createElement("article");
      card.className = `audit-alert-card ${alert.tone}`;
      const icon = document.createElement("span");
      icon.className = "audit-alert-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = alert.tone === "is-warning" ? "⚠" : "!";
      const copy = document.createElement("div");
      copy.className = "audit-alert-copy";
      const audience = document.createElement("span");
      audience.className = "audit-alert-audience";
      audience.textContent = alert.audience;
      const message = document.createElement("p");
      message.textContent = alert.message;
      copy.append(audience, message);
      const view = document.createElement("button");
      view.type = "button";
      view.className = "audit-alert-view";
      if (alert.search) {
        view.dataset.auditSearch = alert.search;
      }
      if (alert.destination) {
        view.dataset.auditDestination = alert.destination;
      }
      view.textContent = "View";
      card.append(icon, copy, view);
      return card;
    });

    alertGrid.replaceChildren(...cards);
    if (!cards.length) {
      alertGrid.append(emptyAlert);
    }
    notificationCount.textContent = String(alerts.length);
    notificationCount.hidden = alerts.length === 0;
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
    const currentUser = userSelect.value;
    const users = new Map();
    allEvents.forEach((event) => {
      const value = event.account || event.user || "Unknown user";
      const label = event.account
        ? `${event.user || "Unknown user"} (${event.account})`
        : value;
      users.set(value, label);
    });
    userSelect.replaceChildren(new Option("All users", ""));
    [...users.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .forEach(([value, label]) => userSelect.add(new Option(label, value)));
    if ([...userSelect.options].some((option) => option.value === currentUser)) {
      userSelect.value = currentUser;
    }
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
        second: "2-digit",
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
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("pending")) return "is-pending";
    if (normalized.includes("approved") || normalized.includes("paid")) return "is-positive";
    if (normalized.includes("returned")) return "is-returned";
    if (normalized.includes("over budget") || normalized.includes("₱2,950,000")) return "is-danger";
    if (normalized.includes("overdue")) return "is-danger";
    return "is-neutral";
  }

  function createTextCell(value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value || "—";
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
    const userCell = document.createElement("td");
    userCell.className = "audit-user-cell";
    const userText = document.createElement("span");
    userText.textContent = event.user || "Unknown user";
    const accountText = document.createElement("small");
    accountText.textContent = event.account || "Account unavailable";
    userCell.append(userText, accountText);
    const description = event.description ||
      [event.action, event.reference && `Reference: ${event.reference}`, event.before && `From: ${event.before}`, event.after && `To: ${event.after}`]
        .filter(Boolean)
        .join(" · ");
    row.append(
      timeCell,
      userCell,
      createTextCell(event.role || "Unknown role"),
      createTextCell(event.module || event.type || "System"),
      createTextCell(event.action, "audit-action-cell"),
      createTextCell(description, "audit-description-cell"),
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
        const date = typeof event.at === "string" ? event.at.slice(0, 10) : "";
        const matchesDate = (!from || date >= from) && (!to || date <= to);
        const matchesUser = !userSelect.value ||
          (event.account || event.user || "Unknown user") === userSelect.value;
        const matchesAction = !actionSelect.value || event.type === actionSelect.value;
        const query = referenceInput.value.trim().toLowerCase();
        const matchesReference = !query ||
          String(event.reference || "").toLowerCase().includes(query) ||
          String(event.action || "").toLowerCase().includes(query) ||
          String(event.description || "").toLowerCase().includes(query) ||
          String(event.account || "").toLowerCase().includes(query);
        return matchesDate && matchesUser && matchesAction && matchesReference;
      })
      .sort((left, right) => String(right.at).localeCompare(String(left.at)));
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
  document.querySelector("#audit-alerts").addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("[data-audit-search], [data-audit-destination]")
      : null;
    if (button) {
      if (button.dataset.auditDestination) {
        window.location.assign(button.dataset.auditDestination);
        return;
      }
      fromInput.value = "";
      toInput.value = "";
      userSelect.value = "";
      actionSelect.value = "";
      referenceInput.value = button.dataset.auditSearch;
      applyFilters();
      document.querySelector("#audit-log").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  loadSavedActivity();
  renderNotifications();
  populateFilters();
  applyFilters();
}

initializeAuditPage();