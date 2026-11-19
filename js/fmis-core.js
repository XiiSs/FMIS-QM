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

  function logActivity(details) {
    const session = getSession();
    const event = {
      at: new Date().toISOString(),
      user: (session && session.fullName) || "System",
      role: (session && session.role) || "System",
      action: details.action || "Updated record",
      reference: details.reference || "",
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
    const pending = requests.filter((request) =>
      String(request.status || "").toLowerCase().includes("pending"),
    ).length;
    return {
      incomeTotal,
      expenseTotal,
      receivables,
      payables,
      pending,
      cash: 5000000 + incomeTotal - expenseTotal,
    };
  }

  window.FMIS = { keys, read, write, money, getSession, logActivity, summarize };
})();
