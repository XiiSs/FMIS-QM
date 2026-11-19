function initializeDashboard() {
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
    !session.permissions.includes("dashboard")
  ) {
    window.location.replace("login.html");
    return;
  }

  const permissions = new Set(session.permissions);
  const email = session.email.toLowerCase();
  const firstName = session.fullName
    ? session.fullName.trim().split(/\s+/)[0]
    : email.startsWith("management@") ? "Maria" : email.split("@")[0];
  const fullName = session.fullName || (email.startsWith("management@")
    ? "Maria G. Santos"
    : firstName.replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  document.querySelector("#profile-name").textContent = fullName;
  document.querySelector("#profile-role").textContent = session.role;
  document.querySelector("#welcome-name").textContent = firstName;
  document.querySelector("#sidebar-user-name").textContent = session.role;
  document.querySelectorAll(".user-avatar").forEach((avatar) => {
    avatar.textContent = initials;
  });

  document.querySelectorAll("[data-permission]").forEach((element) => {
    if (permissions.has(element.dataset.permission)) {
      return;
    }

    if (element.classList.contains("summary-card")) {
      element.removeAttribute("href");
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
      element.classList.add("is-unavailable");
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

  function updateLiveSummary() {
    if (!window.FMIS) return;
    const summary = window.FMIS.summarize();
    const cards = document.querySelectorAll(".summary-card");
    if (cards.length >= 6) {
      cards[0].querySelector("strong").textContent = window.FMIS.money(summary.cash);
      cards[1].querySelector("strong").textContent = window.FMIS.money(summary.incomeTotal);
      cards[2].querySelector("strong").textContent = window.FMIS.money(summary.expenseTotal);
      cards[3].querySelector("strong").textContent = window.FMIS.money(summary.receivables);
      cards[4].querySelector("strong").textContent = window.FMIS.money(summary.payables);
      cards[5].querySelector("strong").textContent = `${summary.pending} requests`;
    }
    const notificationCount = document.querySelector(".notification-count");
    if (notificationCount) notificationCount.textContent = String(summary.pending);
  }
  updateLiveSummary();
  window.addEventListener("storage", updateLiveSummary);

  const reportPeriod = document.querySelector("#report-period");
  const reportData = document.querySelector("#report-data");
  const emptyPeriodMessage = document.querySelector("#period-empty");

  function updateReportingPeriod() {
    const selectedOption = reportPeriod.selectedOptions[0];
    document.querySelectorAll("[data-report-period]").forEach((date) => {
      date.textContent = selectedOption.textContent;
    });

    const hasData = reportPeriod.value === "2026-10";
    reportData.hidden = !hasData;
    emptyPeriodMessage.hidden = hasData;
  }

  reportPeriod.addEventListener("change", updateReportingPeriod);
  updateReportingPeriod();

  const sidebar = document.querySelector(".dashboard-sidebar");
  const menuToggle = document.querySelector("#menu-toggle");

  function setMenuOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  }

  menuToggle.addEventListener("click", () => {
    setMenuOpen(!sidebar.classList.contains("is-open"));
  });

  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });
}

initializeDashboard();