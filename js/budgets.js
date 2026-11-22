function getBudgetSession() {
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
    !session.permissions.includes("budgets")
  ) {
    window.location.replace("login.html");
    return null;
  }

  return session;
}

const budgetSession = getBudgetSession();

if (budgetSession) {
  initializeBudgetPage(budgetSession);
}

function initializeBudgetPage(session) {
  const permissions = new Set(session.permissions);
  const fullName = window.FMIS.getDisplayName(session);
  const initials = window.FMIS.getInitials(fullName);

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

    if (element.classList.contains("nav-link") || element.classList.contains("budget-forecast-link")) {
      element.removeAttribute("href");
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
      element.classList.add("is-unavailable");
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

    const periodSelect = document.querySelector("#budget-period");
  const { keys, read, parsePeriod, todayDate } = window.FMIS;
  const currentMonth = todayDate().slice(0, 7);

  const months = new Set([
    currentMonth,
    ...Object.keys(read(keys.budgets, {})),
    ...read(keys.expenses, []).map(({ date }) => date?.slice(0, 7)),
    ...Array.from(periodSelect.options, ({ value }) => value),
  ]);

  periodSelect.replaceChildren(
    ...Array.from(months)
      .filter((month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      .sort()
      .reverse()
      .map((month) => new Option(parsePeriod(month).label, month)),
  );

  periodSelect.value = currentMonth;
  const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  function renderBudget(period) {
    const { categories, totalPlanned, totalActual, totalVariance: remaining } = window.FMIS.getBudgetMetrics(window.FMIS.parsePeriod(period));
    const rows = document.querySelector("#budget-rows");
    const chart = document.querySelector("#budget-chart");
    const empty = document.querySelector("#budget-empty");
    const maximum = Math.max(1, ...categories.flatMap(({ planned, actual }) => [planned, actual]));
    const overBudget = categories.filter((item) => item.actual > item.planned);
    const monthName = periodSelect.selectedOptions[0].textContent.split(" ")[0];

    rows.replaceChildren(...categories.map((item) => createBudgetRow(item)));
    empty.hidden = categories.length > 0;
    chart.replaceChildren(...categories.map((item) => createBudgetBar(item, maximum)));

    document.querySelector("#budget-total").textContent = currency.format(totalPlanned);
    document.querySelector("#actual-total").textContent = currency.format(totalActual);
    document.querySelector("#remaining-total").textContent = currency.format(remaining);
    document.querySelector("#budget-period-label").textContent = monthName;
    document.querySelector("#actual-percent").textContent =
      `${totalPlanned ? (totalActual / totalPlanned * 100).toFixed(1) : "0.0"}% used`;
    document.querySelector("#remaining-percent").textContent =
      `${totalPlanned ? (remaining / totalPlanned * 100).toFixed(1) : "0.0"}% left`;
    document.querySelector("#over-budget-count").textContent = String(overBudget.length);
    document.querySelector("#over-budget-detail").textContent = `Of ${categories.length} categories`;
    document.querySelector("#budget-category-count").textContent = `${categories.length} categories`;

    const alert = document.querySelector("#budget-alert");
    if (overBudget.length) {
      const topOverrun = overBudget.sort((left, right) =>
        (right.actual - right.planned) - (left.actual - left.planned)
      )[0];
      alert.hidden = false;
      alert.querySelector("p").textContent =
        `Budget Alert: ${topOverrun.category} expenses have exceeded the allocated budget by ${currency.format(topOverrun.actual - topOverrun.planned)}.`;
      alert.classList.remove("is-neutral");
    } else if (categories.length) {
      alert.hidden = false;
      alert.classList.add("is-neutral");
      alert.querySelector("p").textContent = "Budget Alert: No categories are over budget for this reporting period.";
    } else {
      alert.hidden = true;
    }
  }

  function createBudgetRow(item) {
    const variance = item.planned - item.actual;
    const row = document.createElement("tr");
    if (variance < 0) {
      row.classList.add("is-over-budget");
    }
    const values = [
      item.category,
      currency.format(item.planned),
      currency.format(item.actual),
      `${variance < 0 ? "−" : "+"}${currency.format(Math.abs(variance))}`,
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 0) {
        cell.className = "budget-category-cell";
      } else if (index === 3) {
        cell.className = variance < 0 ? "budget-variance-negative" : "budget-variance-positive";
      }
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `budget-status-chip ${variance < 0 ? "is-over-budget" : "is-within-budget"}`;
    status.textContent = variance < 0 ? "Over Budget" : "Within Budget";
    statusCell.append(status);
    row.append(statusCell);
    return row;
  }

  function createBudgetBar(item, maximum) {
    const category = document.createElement("div");
    category.className = "budget-chart-category";
    const bars = document.createElement("div");
    bars.className = "budget-chart-bars";
    const planned = document.createElement("span");
    planned.className = "budget-chart-bar planned";
    planned.style.height = `${Math.max(3, item.planned / maximum * 100)}%`;
    planned.setAttribute("aria-label", `${item.category} planned: ${currency.format(item.planned)}`);
    const actual = document.createElement("span");
    actual.className = `budget-chart-bar ${item.actual > item.planned ? "over" : "actual"}`;
    actual.style.height = `${Math.max(3, item.actual / maximum * 100)}%`;
    actual.setAttribute("aria-label", `${item.category} actual: ${currency.format(item.actual)}`);
    bars.append(planned, actual);
    const label = document.createElement("span");
    label.className = "budget-chart-label";
    label.textContent = item.category;
    category.append(bars, label);
    return category;
  }

  document.querySelector("#budget-period-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderBudget(periodSelect.value);
  });
  periodSelect.addEventListener("change", () => renderBudget(periodSelect.value));
  renderBudget(periodSelect.value);
}