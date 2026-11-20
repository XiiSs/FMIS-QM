(function () {
  const keys = {
    income: "fmisIncomeRecords",
    expenses: "fmisExpenseRecords",
    requests: "fmisPaymentRequests",
    audit: "fmisAuditEvents",
  };

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : (fallback || []);
    } catch {
      return fallback || [];
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(amount) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem("fmisSession"));
    } catch {
      return null;
    }
  }

  function getDisplayName(session = getSession()) {
    if (session && typeof session.fullName === "string" && session.fullName.trim()) {
      return session.fullName.trim();
    }
    if (session && typeof session.username === "string" && session.username.trim()) {
      return session.username.trim();
    }
    return session && typeof session.email === "string" ? session.email : "Unknown user";
  }

  function getInitials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function logActivity(details) {
    const session = getSession();
    const action = details.action || "Updated record";
    const reference = details.reference || "";
    const event = {
      at: new Date().toISOString(),
      user: getDisplayName(session),
      account: (session && session.email) || "",
      role: (session && session.role) || "System",
      action,
      module: details.module || details.type || "System",
      description: details.description || [action, reference && `Reference: ${reference}`, details.before && `From: ${details.before}`, details.after && `To: ${details.after}`].filter(Boolean).join(" · "),
      reference,
      result: details.result || "Recorded",
      before: details.before || "",
      after: details.after || "",
      type: details.type || "System",
      source: "live",
    };
    const events = read(keys.audit, []);
    events.unshift(event);
    write(keys.audit, events.slice(0, 500));
  }

  function getCashForecast(weekCount = 13, minimumBalance = 3000000) {
    const openingBalance = summarize().cash;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks = Array.from({ length: weekCount }, (_, index) => {
      const start = new Date(today);
      start.setDate(start.getDate() + index * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        week: index + 1,
        start,
        end,
        receipts: 0,
        payments: 0,
      };
    });

    function addToWeek(dateValue, amount, field) {
      if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return;
      }
      const dueDate = new Date(`${dateValue}T00:00:00`);
      if (Number.isNaN(dueDate.valueOf())) {
        return;
      }
      const index = Math.floor((dueDate - today) / (7 * 24 * 60 * 60 * 1000));
      const weekIndex = Math.max(0, index);
      if (weekIndex < weeks.length) {
        weeks[weekIndex][field] += amount;
      }
    }

    read(keys.income, []).forEach((record) => {
      const balance = Math.max(0, Number(record.amount || 0) - Number(record.received || 0));
      if (balance > 0) {
        addToWeek(record.dueDate, balance, "receipts");
      }
    });
    read(keys.expenses, []).forEach((record) => {
      const amount = Number(record.amount || 0);
      if (record.payableStatus !== "Paid" && amount > 0) {
        addToWeek(record.dueDate, amount, "payments");
      }
    });

    let opening = openingBalance;
    return weeks.map((week) => {
      const netCashFlow = week.receipts - week.payments;
      const closing = opening + netCashFlow;
      const forecastWeek = {
        ...week,
        opening,
        netCashFlow,
        closing,
        low: closing < minimumBalance,
      };
      opening = closing;
      return forecastWeek;
    });
  }

  function summarize() {
    const income = read(keys.income, []);
    const expenses = read(keys.expenses, []);
    const requests = read(keys.requests, []);
    const receivables = income.reduce(
      (total, record) => total + Math.max(0, Number(record.amount || 0) - Number(record.received || 0)),
      0,
    );
    const payables = expenses
      .filter((record) => record.payableStatus !== "Paid")
      .reduce((total, record) => total + Number(record.amount || 0), 0);
    const incomeTotal = income.reduce((total, record) => total + Number(record.received || 0), 0);
    const expenseTotal = expenses.reduce((total, record) => total + Number(record.amount || 0), 0);
    const paidExpenseTotal = expenses
      .filter((record) => record.payableStatus === "Paid")
      .reduce((total, record) => total + Number(record.amount || 0), 0);
    const pending = requests.filter((request) =>
      String(request.status || "").toLowerCase().includes("pending"),
    ).length;
    return {
      incomeTotal,
      expenseTotal,
      receivables,
      payables,
      pending,
      cash: 5000000 + incomeTotal - paidExpenseTotal,
    };
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('a[href="login.html"]')) {
      return;
    }
    if (getSession()) {
      try {
        logActivity({
          action: "Signed out",
          module: "Authentication",
          type: "Authentication",
          description: "User signed out of the system.",
        });
      } catch (error) {
        console.error("Sign-out activity could not be recorded.", error);
      }
      sessionStorage.removeItem("fmisSession");
    }
  });

  window.FMIS = {
    keys,
    read,
    write,
    money,
    getSession,
    getDisplayName,
    getInitials,
    logActivity,
    summarize,
    getCashForecast,
  };
})();
