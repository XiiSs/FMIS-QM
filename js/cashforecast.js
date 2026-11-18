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
  const email = session.email.toLowerCase();
  const name = session.fullName || (email.startsWith("management@") || email.startsWith("preparer@")
    ? "Maria G. Santos"
    : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
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

  renderCashForecast();
}

function renderCashForecast() {
  const openingBalance = 5000000;
  const minimumBalance = 3000000;
  const expectedReceipts = [
    1200000, 1100000, 1300000, 1250000, 1150000, 1200000, 1500000,
    1200000, 1300000, 1200000, 950000, 1150000, 1200000,
  ];
  const plannedPayments = [
    1450000, 1300000, 1400000, 1350000, 1200000, 1450000, 1800000,
    1650000, 1450000, 1400000, 1150000, 1400000, 1450000,
  ];
  const weeks = [];
  let opening = openingBalance;

  expectedReceipts.forEach((receipts, index) => {
    const payments = plannedPayments[index];
    const netCashFlow = receipts - payments;
    const closing = opening + netCashFlow;
    weeks.push({
      week: index + 1,
      opening,
      receipts,
      payments,
      netCashFlow,
      closing,
      low: closing < minimumBalance,
    });
    opening = closing;
  });

  const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
  const totalReceipts = expectedReceipts.reduce((total, amount) => total + amount, 0);
  const totalPayments = plannedPayments.reduce((total, amount) => total + amount, 0);
  const firstLowWeek = weeks.find((week) => week.low)?.week ?? null;
  const lastWeek = weeks[weeks.length - 1];

  document.querySelector("#cashflow-opening").textContent = currency.format(openingBalance);
  document.querySelector("#cashflow-receipts").textContent = currency.format(totalReceipts);
  document.querySelector("#cashflow-payments").textContent = currency.format(totalPayments);
  document.querySelector("#cashflow-closing").textContent = currency.format(lastWeek.closing);

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
  if (firstLowWeek !== null) {
    const lowWeekCount = weeks.filter((week) => week.low).length;
    const warningText =
      `Low Cash Warning: Projected cash falls below the ${currency.format(minimumBalance)} minimum threshold starting in Week ${firstLowWeek}, with a projected closing balance of ${currency.format(weeks[firstLowWeek - 1].closing)}.`;
    document.querySelector("#cashflow-chart-alert-text").textContent =
      `Weeks ${firstLowWeek}–${lastWeek.week} below minimum`;
    chartAlert.hidden = false;
    warning.querySelector("p").textContent = warningText;
    warning.hidden = false;
  } else {
    chartAlert.hidden = true;
    warning.hidden = true;
  }

  renderCashChart(weeks, minimumBalance, currency);
}

function renderCashChart(weeks, minimumBalance, currency) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const width = 560;
  const height = 220;
  const plot = { left: 42, right: 548, top: 16, bottom: 177 };
  const minimum = 2000000;
  const maximum = 5000000;
  const x = (index) => plot.left + index * (plot.right - plot.left) / (weeks.length - 1);
  const y = (value) => plot.top + (maximum - value) * (plot.bottom - plot.top) / (maximum - minimum);
  const chart = document.querySelector("#cashflow-chart");
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "presentation");
  svg.setAttribute("focusable", "false");

  [2000000, 3000000, 4000000, 5000000].forEach((value) => {
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
    label.textContent = (value / 1000000).toFixed(1);
    svg.append(label);
  });

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