function initializeCashForecast() {
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
    !session.permissions.includes("cashforecast")
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

  renderCashForecast();
}

function renderCashForecast() {
  const minimumBalance = 3000000;
  const weeks = window.FMIS.getCashForecast(13, minimumBalance);
  const openingBalance = weeks[0].opening;

  const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
  const totalReceipts = weeks.reduce((total, week) => window.FMIS.addMoney(total, week.receipts), 0);
  const totalPayments = weeks.reduce((total, week) => window.FMIS.addMoney(total, week.payments), 0);
  const lowWeeks = weeks.filter((week) => week.low);
  const lastWeek = weeks[weeks.length - 1];
  const firstLow = lowWeeks[0];
  const weekSelect = document.querySelector("#forecast-week");
  const details = document.querySelector("#forecast-week-items");
  weekSelect.replaceChildren(...weeks.map((week) =>
    new Option(`Week ${week.week} · ${formatForecastDate(week.start)} to ${formatForecastDate(week.end)}`, week.week)));
  weekSelect.value = firstLow?.week || 1;
  const renderWeek = () => {
    const week = weeks[Number(weekSelect.value) - 1];
    const items = week.items.slice().sort((left, right) => left.date.localeCompare(right.date));
    details.replaceChildren(...items.map((entry) => {
      const item = document.createElement("li");
      const movement = entry.field === "receipts" ? "Expected collection" : "Planned payment";
      item.textContent = `${entry.date} · ${movement} · ${entry.reference} · ${entry.party} · ${window.FMIS.money(entry.amount)}`;
      return item;
    }));
    if (!items.length) {
      const item = document.createElement("li");
      item.textContent = "No receipts or payments scheduled.";
      details.append(item);
    }
  };
  weekSelect.addEventListener("change", renderWeek);
  renderWeek();
  window.renderLiquiditySummary(document.querySelector("#forecast-liquidity-ratios"));

  document.querySelector("#cashflow-opening").textContent = currency.format(openingBalance);
  document.querySelector("#cashflow-receipts").textContent = currency.format(totalReceipts);
  document.querySelector("#cashflow-payments").textContent = currency.format(totalPayments);
  document.querySelector("#cashflow-closing").textContent = currency.format(lastWeek.closing);
  document.querySelector("#cashflow-closing-card").classList.toggle("is-low", lastWeek.low);
  document.querySelector("#cashflow-period").textContent =
    `${formatForecastDate(weeks[0].start)} – ${formatForecastDate(lastWeek.end)}`;

  const tableBody = document.querySelector("#cashflow-rows");
  tableBody.replaceChildren(...weeks.map((week) => {
    const row = document.createElement("tr");
    if (week.low) {
      row.classList.add("is-low-cash");
    }

    const values = [
      String(week.week).padStart(2, "0"),
      currency.format(week.opening),
      currency.format(week.receipts),
      currency.format(week.payments),
      `${week.netCashFlow < 0 ? "−" : "+"}${currency.format(Math.abs(week.netCashFlow))}`,
      currency.format(week.closing),
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 0) {
        cell.className = "cashflow-week-cell";
      } else if (index === 4) {
        cell.className = week.netCashFlow < 0 ? "cashflow-net-negative" : "cashflow-net-positive";
      } else if (index === 2) {
        cell.className = "cashflow-inflow-value";
      } else if (index === 3) {
        cell.className = "cashflow-outflow-value";
      } else if (index === 5 && week.low) {
        cell.className = "cashflow-low-value";
      }
      row.append(cell);
    });

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `cashflow-status ${week.low ? "is-low" : "is-sufficient"}`;
    status.textContent = week.low ? "Low Cash" : "Sufficient cash";
    statusCell.append(status);
    row.append(statusCell);
    return row;
  }));

  const chartAlert = document.querySelector("#cashflow-chart-alert");
  const warning = document.querySelector("#cashflow-warning");
  if (lowWeeks.length) {
    const firstLowWeek = lowWeeks[0].week;
    const lowWeekLabels = lowWeeks.map((week) => week.week).join(", ");
    const warningText =
      `Low Cash Warning: Projected closing cash falls below ${currency.format(minimumBalance)} in Week${lowWeeks.length === 1 ? "" : "s"} ${lowWeekLabels}. Week ${firstLowWeek} closes at ${currency.format(firstLow.closing)} and needs ${currency.format(window.FMIS.subMoney(minimumBalance, firstLow.closing))} to reach the minimum.`;
    document.querySelector("#cashflow-chart-alert-text").textContent =
      `Below minimum in week${lowWeeks.length === 1 ? "" : "s"} ${lowWeekLabels}`;
    chartAlert.hidden = false;
    warning.querySelector("p").textContent = warningText;
    warning.hidden = false;
  } else {
    chartAlert.hidden = true;
    warning.hidden = true;
  }

  renderCashChart(weeks, minimumBalance, currency);
}

function formatForecastDate(date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function renderCashChart(weeks, minimumBalance, currency) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const width = 560;
  const height = 220;
  const plot = { left: 42, right: 548, top: 16, bottom: 177 };
  const balances = weeks.map((week) => week.closing).concat(minimumBalance);
  const minimum = Math.floor(Math.min(...balances) / 1000000) * 1000000;
  const maximum = Math.ceil(Math.max(...balances) / 1000000) * 1000000 || 1000000;
  const chartMinimum = minimum === maximum ? minimum - 1000000 : minimum;
  const chartMaximum = minimum === maximum ? maximum + 1000000 : maximum;
  const x = (index) => plot.left + index * (plot.right - plot.left) / (weeks.length - 1);
  const y = (value) => plot.top + (chartMaximum - value) * (plot.bottom - plot.top) / (chartMaximum - chartMinimum);
  const chart = document.querySelector("#cashflow-chart");
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Projected ending cash for 13 weeks. ${weeks.filter((week) => week.low).length} weeks below the ${currency.format(minimumBalance)} minimum threshold.`);
  svg.setAttribute("focusable", "false");

  const firstGridline = Math.ceil(chartMinimum / 1000000) * 1000000;
  for (let value = firstGridline; value <= chartMaximum; value += 1000000) {
    const line = document.createElementNS(svgNamespace, "line");
    line.setAttribute("x1", plot.left);
    line.setAttribute("x2", plot.right);
    line.setAttribute("y1", y(value));
    line.setAttribute("y2", y(value));
    line.setAttribute("class", "cashflow-gridline");
    svg.append(line);

    const label = document.createElementNS(svgNamespace, "text");
    label.setAttribute("x", 2);
    label.setAttribute("y", y(value) + 3);
    label.setAttribute("class", "cashflow-axis-label");
    label.textContent = (value / 1000000).toFixed(0);
    svg.append(label);
  }

  const threshold = document.createElementNS(svgNamespace, "line");
  threshold.setAttribute("x1", plot.left);
  threshold.setAttribute("x2", plot.right);
  threshold.setAttribute("y1", y(minimumBalance));
  threshold.setAttribute("y2", y(minimumBalance));
  threshold.setAttribute("class", "cashflow-threshold-line");
  svg.append(threshold);

  const path = document.createElementNS(svgNamespace, "polyline");
  path.setAttribute("points", weeks.map((week, index) => `${x(index)},${y(week.closing)}`).join(" "));
  path.setAttribute("class", "cashflow-line");
  svg.append(path);

  weeks.forEach((week, index) => {
    const point = document.createElementNS(svgNamespace, "circle");
    point.setAttribute("cx", x(index));
    point.setAttribute("cy", y(week.closing));
    point.setAttribute("r", "3");
    point.setAttribute("class", `cashflow-point${week.low ? " is-low" : ""}`);
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = `Week ${week.week}: closing cash ${currency.format(week.closing)}`;
    point.append(title);
    svg.append(point);

    const label = document.createElementNS(svgNamespace, "text");
    label.setAttribute("x", x(index));
    label.setAttribute("y", plot.bottom + 15);
    label.setAttribute("class", `cashflow-week-label${week.low ? " is-low" : ""}`);
    label.textContent = String(week.week);
    svg.append(label);
  });

  chart.replaceChildren(svg);
}

initializeCashForecast();