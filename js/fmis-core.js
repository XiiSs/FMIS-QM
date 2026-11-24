/**
 * FMIS-QM Core Financial Engine & Utilities
 * Provides:
 *  - Canonical storage keys and state initialization (localStorage)
 *  - Integer centavo arithmetic to prevent IEEE 754 precision loss
 *  - Unified period filtering (Month, Quarter, Year, Custom range)
 *  - Centralized financial calculations: Income, Expenses, AR/AP Aging,
 *    Budgets, Cash Flow, Financial Indicators, and System Alerts
 *  - Role-based session management and audit logging
 */
(function () {
  "use strict";

  const keys = {
    income: "fmisIncomeRecords",
    expenses: "fmisExpenseRecords",
    requests: "fmisPaymentRequests",
    audit: "fmisAuditEvents",
    budgets: "fmisBudgetAllocations",
  };

  /* ---------- Default Canonical Datasets (Seeded only if storage is empty) ---------- */
  const seedIncomeRecords = [
    {
      date: "2026-10-28",
      invoice: "INV-2026-1045",
      customer: "ABC Retail",
      category: "Product Sales",
      description: "Sale to ABC Retail",
      amount: 180000,
      received: 0,
      status: "Invoiced",
      dueDate: "2026-11-27",
    },
    {
      date: "2026-10-25",
      invoice: "INV-2026-1044",
      customer: "DEF Mart",
      category: "Product Sales",
      description: "Sale to DEF Mart",
      amount: 220000,
      received: 100000,
      status: "Partially Paid",
      dueDate: "2026-11-24",
    },
    {
      date: "2026-10-20",
      invoice: "INV-2026-1043",
      customer: "GHI Supermarket",
      category: "Product Sales",
      description: "Sale to GHI Supermarket",
      amount: 150000,
      received: 150000,
      status: "Received",
      dueDate: "2026-11-19",
    },
    {
      date: "2026-10-18",
      invoice: "INV-2026-1042",
      customer: "JKL Traders",
      category: "Other Income",
      description: "Other income from JKL Traders",
      amount: 75000,
      received: 0,
      status: "Invoiced",
      dueDate: "2026-11-17",
    },
    {
      date: "2026-10-16",
      invoice: "INV-2026-1041",
      customer: "MNO Wholesaler",
      category: "Product Sales",
      description: "Sale to MNO Wholesaler",
      amount: 200000,
      received: 50000,
      status: "Partially Paid",
      dueDate: "2026-11-15",
    },
    // September 2026 records for comparative analysis
    {
      date: "2026-09-26",
      invoice: "INV-2026-0935",
      customer: "Metro Grocers",
      category: "Product Sales",
      description: "Sale to Metro Grocers",
      amount: 320000,
      received: 320000,
      status: "Received",
      dueDate: "2026-10-26",
    },
    {
      date: "2026-09-18",
      invoice: "INV-2026-0930",
      customer: "Bayview Mart",
      category: "Product Sales",
      description: "Sale to Bayview Mart",
      amount: 280000,
      received: 280000,
      status: "Received",
      dueDate: "2026-10-18",
    },
    {
      date: "2026-09-10",
      invoice: "INV-2026-0925",
      customer: "Sunrise Foods",
      category: "Other Income",
      description: "Byproduct sales",
      amount: 150000,
      received: 150000,
      status: "Received",
      dueDate: "2026-10-10",
    },
  ];

  const seedExpenseRecords = [
    {
      expenseId: "EXP-2026-0311",
      transactionId: "EXP-2026-0311",
      date: "2026-10-27",
      vendor: "Supreme Packaging Corp.",
      amount: 120000,
      category: "Raw Materials",
      dueDate: "2026-11-15",
      reference: "INV-SUP-8821",
      documentName: "supreme-packaging-311.pdf",
      payableStatus: "Payment Requested",
      paymentRequestId: "PR-2026-0012",
    },
    {
      expenseId: "EXP-2026-0312",
      transactionId: "EXP-2026-0312",
      date: "2026-10-24",
      vendor: "Manila Electric Company",
      amount: 45000,
      category: "Utilities",
      dueDate: "2026-11-08",
      reference: "UTIL-2026-109",
      documentName: "meralco-bill-oct.pdf",
      payableStatus: "Open",
      paymentRequestId: null,
    },
    {
      expenseId: "EXP-2026-0313",
      transactionId: "EXP-2026-0313",
      date: "2026-10-20",
      vendor: "FastTrack Logistics",
      amount: 65000,
      category: "Transportation",
      dueDate: "2026-11-05",
      reference: "WAYBILL-4491",
      documentName: "fasttrack-waybill.pdf",
      payableStatus: "Open",
      paymentRequestId: null,
    },
    {
      expenseId: "EXP-2026-0314",
      transactionId: "EXP-2026-0314",
      date: "2026-10-15",
      vendor: "Agro Feeds Milling Corp.",
      amount: 350000,
      category: "Raw Materials",
      dueDate: "2026-10-30",
      reference: "INV-AFM-0941",
      documentName: "agro-feeds-invoice.pdf",
      payableStatus: "Open",
      paymentRequestId: null,
    },
    {
      expenseId: "EXP-2026-0315",
      transactionId: "EXP-2026-0315",
      date: "2026-10-10",
      vendor: "HeavyDuty Equipment Services",
      amount: 50000,
      category: "Maintenance",
      dueDate: "2026-10-25",
      reference: "SERV-HD-102",
      documentName: "heavyduty-job-order.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0008",
    },
    {
      expenseId: "EXP-2026-0316",
      transactionId: "EXP-2026-0316",
      date: "2026-10-05",
      vendor: "Central Luzon Cold Storage",
      amount: 110000,
      category: "Operations",
      dueDate: "2026-10-20",
      reference: "LEASE-CLCS-88",
      documentName: "clcs-lease-agreement.pdf",
      payableStatus: "Open",
      paymentRequestId: null,
    },
    {
      expenseId: "EXP-2026-0317",
      transactionId: "EXP-2026-0317",
      date: "2026-10-02",
      vendor: "Provincial Water District",
      amount: 25000,
      category: "Utilities",
      dueDate: "2026-10-18",
      reference: "WATER-OCT-2026",
      documentName: "water-district-receipt.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0005",
    },
    // September 2026 expenses for comparative analysis
    {
      expenseId: "EXP-2026-0280",
      transactionId: "EXP-2026-0280",
      date: "2026-09-22",
      vendor: "Agro Feeds Milling Corp.",
      amount: 420000,
      category: "Raw Materials",
      dueDate: "2026-10-05",
      reference: "INV-AFM-0881",
      documentName: "agro-feeds-sep.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0001",
    },
    {
      expenseId: "EXP-2026-0281",
      transactionId: "EXP-2026-0281",
      date: "2026-09-15",
      vendor: "Central Luzon Cold Storage",
      amount: 110000,
      category: "Operations",
      dueDate: "2026-09-30",
      reference: "LEASE-CLCS-87",
      documentName: "clcs-lease-sep.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0002",
    },
    {
      expenseId: "EXP-2026-0282",
      transactionId: "EXP-2026-0282",
      date: "2026-09-10",
      vendor: "FastTrack Logistics",
      amount: 60000,
      category: "Transportation",
      dueDate: "2026-09-25",
      reference: "WAYBILL-4310",
      documentName: "fasttrack-sep.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0003",
    },
    {
      expenseId: "EXP-2026-0283",
      transactionId: "EXP-2026-0283",
      date: "2026-09-05",
      vendor: "Manila Electric Company",
      amount: 40000,
      category: "Utilities",
      dueDate: "2026-09-20",
      reference: "UTIL-2026-098",
      documentName: "meralco-sep.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0004",
    },
    {
      expenseId: "EXP-2026-0284",
      transactionId: "EXP-2026-0284",
      date: "2026-09-02",
      vendor: "Prime Machinery Care",
      amount: 90000,
      category: "Maintenance",
      dueDate: "2026-09-18",
      reference: "SERV-PMC-09",
      documentName: "pmc-maintenance-sep.pdf",
      payableStatus: "Paid",
      paymentRequestId: "PR-2026-0006",
    },
  ];

  const seedPaymentRequests = [
    {
      requestId: "PR-2026-0012",
      expenseId: "EXP-2026-0311",
      amount: 120000,
      vendor: "Supreme Packaging Corp.",
      category: "Raw Materials",
      dueDate: "2026-11-15",
      requestedDate: "2026-10-27",
      documentName: "supreme-packaging-311.pdf",
      status: "Submitted",
      preparedBy: "Finance Preparer",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-10-27T09:30:00.000Z",
      comments: "Payment request for packing materials supply.",
      history: [
        {
          at: "2026-10-27T09:30:00.000Z",
          user: "Finance Preparer",
          role: "Finance Preparer",
          action: "Submitted",
          status: "Pending Approval",
          comments: "Payment request created separately after payable was saved.",
        },
      ],
    },
    {
      requestId: "PR-2026-0008",
      expenseId: "EXP-2026-0315",
      amount: 50000,
      vendor: "HeavyDuty Equipment Services",
      category: "Maintenance",
      dueDate: "2026-10-25",
      requestedDate: "2026-10-10",
      documentName: "heavyduty-job-order.pdf",
      status: "Approved",
      preparedBy: "Finance Preparer",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-10-10T14:15:00.000Z",
      decidedBy: "Approver",
      decidedByRole: "Approver",
      decidedAt: "2026-10-11T08:45:00.000Z",
      comments: "Routine equipment overhaul approved.",
      history: [
        {
          at: "2026-10-10T14:15:00.000Z",
          user: "Finance Preparer",
          role: "Finance Preparer",
          action: "Submitted",
          status: "Pending Approval",
          comments: "Submitted.",
        },
        {
          at: "2026-10-11T08:45:00.000Z",
          user: "Approver",
          role: "Approver",
          action: "Approved",
          status: "Approved",
          comments: "Approved after invoice verification.",
        },
      ],
    },
    {
      requestId: "PR-2026-0005",
      expenseId: "EXP-2026-0317",
      amount: 25000,
      vendor: "Provincial Water District",
      category: "Utilities",
      dueDate: "2026-10-18",
      requestedDate: "2026-10-02",
      documentName: "water-district-receipt.pdf",
      status: "Approved",
      preparedBy: "Finance Preparer",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-10-02T10:00:00.000Z",
      decidedBy: "Approver",
      decidedByRole: "Approver",
      decidedAt: "2026-10-03T11:20:00.000Z",
      comments: "Water bill verified and approved.",
      history: [],
    },
    {
      requestId: "PR-2026-0004",
      expenseId: "EXP-2026-0308",
      amount: 40000,
      vendor: "Supreme Packaging Corp.",
      category: "Raw Materials",
      dueDate: "2026-10-22",
      requestedDate: "2026-10-08",
      documentName: "packaging-batch-1.pdf",
      status: "Returned for Correction",
      preparedBy: "Finance Preparer",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-10-08T16:00:00.000Z",
      decidedBy: "Approver",
      decidedByRole: "Approver",
      decidedAt: "2026-10-09T09:10:00.000Z",
      comments: "Missing receiver signature on delivery slip. Please re-attach and resubmit.",
      history: [],
    },
    {
      requestId: "PR-2026-0003",
      expenseId: "EXP-2026-0309",
      amount: 35000,
      vendor: "FastTrack Logistics",
      category: "Transportation",
      dueDate: "2026-10-20",
      requestedDate: "2026-10-06",
      documentName: "freight-quote.pdf",
      status: "Rejected",
      preparedBy: "Finance Preparer",
      preparedByEmail: "preparer@fmis.example",
      preparedRole: "Finance Preparer",
      submittedAt: "2026-10-06T11:30:00.000Z",
      decidedBy: "Approver",
      decidedByRole: "Approver",
      decidedAt: "2026-10-07T13:40:00.000Z",
      comments: "Rate exceeds agreed contracted pricing tariff.",
      history: [],
    },
  ];

  const seedBudgets = {
    "2026-10": [
      { category: "Raw Materials", planned: 800000 },
      { category: "Operations", planned: 500000 },
      { category: "Transportation", planned: 300000 },
      { category: "Utilities", planned: 200000 },
      { category: "Maintenance", planned: 200000 },
    ],
    "2026-09": [
      { category: "Raw Materials", planned: 750000 },
      { category: "Operations", planned: 480000 },
      { category: "Transportation", planned: 280000 },
      { category: "Utilities", planned: 190000 },
      { category: "Maintenance", planned: 180000 },
    ],
  };

  function initializeSeeds() {
    try {
      if (localStorage.getItem(keys.income) === null) {
        localStorage.setItem(keys.income, JSON.stringify(seedIncomeRecords));
      }
      if (localStorage.getItem(keys.expenses) === null) {
        localStorage.setItem(keys.expenses, JSON.stringify(seedExpenseRecords));
      }
      if (localStorage.getItem(keys.requests) === null) {
        localStorage.setItem(keys.requests, JSON.stringify(seedPaymentRequests));
      }
      if (localStorage.getItem(keys.budgets) === null) {
        localStorage.setItem(keys.budgets, JSON.stringify(seedBudgets));
      }
    } catch (e) {
      console.warn("FMIS Seed initialization skipped:", e);
    }
  }
  initializeSeeds();

  /* ---------- Storage Read/Write ---------- */
  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) || (value && typeof value === "object") ? value : (fallback || []);
    } catch {
      return fallback || [];
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- Accurate Currency & Centavo Arithmetic ---------- */
  function toCents(amount) {
    return Math.round((Number(amount) || 0) * 100);
  }

  function fromCents(cents) {
    return Math.round(Number(cents) || 0) / 100;
  }

  function addMoney(a, b) {
    return fromCents(toCents(a) + toCents(b));
  }

  function subMoney(a, b) {
    return fromCents(toCents(a) - toCents(b));
  }

  function money(amount, options = {}) {
    if (amount === null) return "Unavailable";
    const val = Number(amount) || 0;
    const isNegative = val < 0;
    const minDigits = options.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : (options.maximumFractionDigits !== undefined ? Math.min(2, options.maximumFractionDigits) : 2);
    const maxDigits = options.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : Math.max(2, minDigits);

    const formatted = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      ...options,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(Math.abs(val));
    return isNegative ? `−${formatted}` : formatted;
  }

  function formatPercent(pct, decimals = 1) {
    const val = Number(pct) || 0;
    const sign = val > 0 ? "+" : val < 0 ? "−" : "";
    return `${sign}${Math.abs(val).toFixed(decimals)}%`;
  }

  /* ---------- Session & User Identification ---------- */
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

  /* ---------- Audit Logging ---------- */
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

  /* ---------- Reporting Period & Date Helpers ---------- */
  function parsePeriod(periodValue, customStart, customEnd) {
    const now = new Date();
    // Default reference month is October 2026 per FMIS prototype standard
    const refYear = 2026;
    const refMonth = 10; // October

    if (periodValue === "custom" && customStart && customEnd) {
      return {
        type: "custom",
        label: `${customStart} to ${customEnd}`,
        start: customStart,
        end: customEnd,
        prevStart: null,
        prevEnd: null,
      };
    }

    if (periodValue === "quarter" || periodValue === "this-quarter") {
      // Q4 2026: Oct 1 to Dec 31, 2026. Prev: Q3 (Jul 1 - Sep 30)
      return {
        type: "quarter",
        label: "Fourth Quarter 2026 (Q4)",
        start: "2026-10-01",
        end: "2026-12-31",
        prevStart: "2026-07-01",
        prevEnd: "2026-09-30",
        prevLabel: "Q3 2026",
      };
    }

    if (periodValue === "year" || periodValue === "this-year") {
      // Full Year 2026. Prev: 2025
      return {
        type: "year",
        label: "Fiscal Year 2026",
        start: "2026-01-01",
        end: "2026-12-31",
        prevStart: "2025-01-01",
        prevEnd: "2025-12-31",
        prevLabel: "FY 2025",
      };
    }

    // Default to month format YYYY-MM
    const ym = (/^\d{4}-\d{2}$/.test(periodValue)) ? periodValue : "2026-10";
    const [year, month] = ym.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${ym}-01`;
    const end = `${ym}-${String(lastDay).padStart(2, "0")}`;

    // Previous month
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYm = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevStart = `${prevYm}-01`;
    const prevEnd = `${prevYm}-${String(prevLastDay).padStart(2, "0")}`;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return {
      type: "month",
      ym,
      label: `${monthNames[month - 1]} ${year}`,
      start,
      end,
      prevStart,
      prevEnd,
      prevLabel: `${monthNames[prevMonth - 1]} ${prevYear}`,
    };
  }

  function inDateRange(dateStr, start, end) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  }

  /* ---------- Unified Financial Metrics Engines ---------- */

  // Income Metrics
  function getIncomeMetrics(periodObj) {
    const records = read(keys.income, []);
    const filtered = records.filter((r) => inDateRange(r.date, periodObj.start, periodObj.end));

    let invoicedCents = 0;
    let receivedCents = 0;
    let outstandingCents = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    filtered.forEach((r) => {
      const amtCents = toCents(r.amount);
      const recCents = toCents(r.received);
      const balCents = Math.max(0, amtCents - recCents);

      invoicedCents += amtCents;
      receivedCents += recCents;
      outstandingCents += balCents;

      if (balCents === 0 && amtCents > 0) {
        paidCount++;
      } else if (recCents > 0) {
        partialCount++;
      } else {
        unpaidCount++;
      }
    });

    // Previous period revenue for comparison
    let prevInvoicedCents = 0;
    if (periodObj.prevStart && periodObj.prevEnd) {
      records
        .filter((r) => inDateRange(r.date, periodObj.prevStart, periodObj.prevEnd))
        .forEach((r) => {
          prevInvoicedCents += toCents(r.amount);
        });
    }

    const totalRevenue = fromCents(invoicedCents);
    const totalCollected = fromCents(receivedCents);
    const outstandingAR = fromCents(outstandingCents);
    const prevRevenue = fromCents(prevInvoicedCents);

    const changePct = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : null;

    return {
      totalRevenue,
      totalCollected,
      outstandingAR,
      prevRevenue,
      changePct,
      invoiceCount: filtered.length,
      paidCount,
      partialCount,
      unpaidCount,
      records: filtered,
    };
  }

  // Expense Metrics
  function getExpenseMetrics(periodObj) {
    const records = read(keys.expenses, []);
    const filtered = records.filter((r) => inDateRange(r.date, periodObj.start, periodObj.end));

    let expenseCents = 0;
    let paidCents = 0;
    let openCents = 0;
    let paidCount = 0;
    let openCount = 0;

    const byCategoryCents = {};
    const byVendorCents = {};

    filtered.forEach((r) => {
      const amtCents = toCents(r.amount);
      const isPaid = r.payableStatus === "Paid";
      expenseCents += amtCents;

      if (isPaid) {
        paidCents += amtCents;
        paidCount++;
      } else {
        openCents += amtCents;
        openCount++;
      }

      const cat = r.category || "Other";
      byCategoryCents[cat] = (byCategoryCents[cat] || 0) + amtCents;

      const ven = r.vendor || "Unknown Vendor";
      byVendorCents[ven] = (byVendorCents[ven] || 0) + amtCents;
    });

    // Previous period expenses for comparison
    let prevExpenseCents = 0;
    if (periodObj.prevStart && periodObj.prevEnd) {
      records
        .filter((r) => inDateRange(r.date, periodObj.prevStart, periodObj.prevEnd))
        .forEach((r) => {
          prevExpenseCents += toCents(r.amount);
        });
    }

    const totalExpenses = fromCents(expenseCents);
    const paidExpenses = fromCents(paidCents);
    const outstandingAP = fromCents(openCents);
    const prevExpenses = fromCents(prevExpenseCents);

    const changePct = prevExpenses > 0
      ? ((totalExpenses - prevExpenses) / prevExpenses) * 100
      : null;

    const byCategory = Object.entries(byCategoryCents).map(([cat, cents]) => ({
      category: cat,
      amount: fromCents(cents),
      percentage: totalExpenses > 0 ? (fromCents(cents) / totalExpenses) * 100 : 0,
    }));

    const byVendor = Object.entries(byVendorCents).map(([ven, cents]) => ({
      vendor: ven,
      amount: fromCents(cents),
      percentage: totalExpenses > 0 ? (fromCents(cents) / totalExpenses) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);

    return {
      totalExpenses,
      paidExpenses,
      outstandingAP,
      prevExpenses,
      changePct,
      expenseCount: filtered.length,
      paidCount,
      openCount,
      byCategory,
      byVendor,
      records: filtered,
    };
  }

  // Budget & Variance Metrics
  function getBudgetMetrics(periodObj) {
        const rawBudgets = read(keys.budgets, seedBudgets);
    const expenseMetrics = getExpenseMetrics(periodObj);
    const plannedByCategory = new Map();
    const plannedCategoriesByMonth = new Map();
    const categoriesByMonth = new Map();

    expenseMetrics.records.forEach(({ date, category }) => {
      const month = date.slice(0, 7);

      if (!categoriesByMonth.has(month)) {
        categoriesByMonth.set(month, new Map());
      }

      const name = category?.trim() || "Other";
      categoriesByMonth.get(month).set(name.toLowerCase(), name);
    });

    const months = new Set([
      ...Object.keys(rawBudgets),
      ...categoriesByMonth.keys(),
    ]);

    months.forEach((month) => {
      const period = parsePeriod(month);
      if (period.start < periodObj.start || period.end > periodObj.end) return;

      const allocations = rawBudgets[month] || Array.from(
        categoriesByMonth.get(month)?.values() || [],
        (category) => ({ category, planned: 10000 }),
      );

      plannedCategoriesByMonth.set(
        month,
        new Set(allocations.map(({ category }) => category.trim().toLowerCase())),
      );

      allocations.forEach(({ category, planned }) => {
        plannedByCategory.set(
          category,
          addMoney(plannedByCategory.get(category) || 0, planned),
        );
      });
    });

    const configured = Array.from(
      plannedByCategory,
      ([category, planned]) => ({ category, planned }),
    );

    const actualsByCat = {};
    expenseMetrics.records.forEach((expense) => {
      const category = expense.category?.trim().toLowerCase() || "other";
      const month = expense.date.slice(0, 7);

      if (!plannedCategoriesByMonth.get(month)?.has(category)) return;

      actualsByCat[category] = addMoney(
        actualsByCat[category] || 0,
        expense.amount,
      );
    });

    let totalPlannedCents = 0;
    let totalActualCents = 0;

    const categories = configured.map((item) => {
      const plannedCents = toCents(item.planned);
      const actualCents = toCents(actualsByCat[item.category.toLowerCase()] || 0);
      const varianceCents = plannedCents - actualCents; // Planned - Actual (favorable > 0)
      const utilization = plannedCents > 0 ? (actualCents / plannedCents) * 100 : 0;

      totalPlannedCents += plannedCents;
      totalActualCents += actualCents;

      return {
        category: item.category,
        planned: fromCents(plannedCents),
        actual: fromCents(actualCents),
        variance: fromCents(varianceCents),
        utilization,
        isOverBudget: varianceCents < 0,
      };
    });

    const totalPlanned = fromCents(totalPlannedCents);
    const totalActual = fromCents(totalActualCents);
    const totalVariance = fromCents(totalPlannedCents - totalActualCents);
    const totalUtilization = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    return {
      periodLabel: periodObj.label,
      categories,
      totalPlanned,
      totalActual,
      totalVariance,
      totalUtilization,
      overBudgetCount: categories.filter((c) => c.isOverBudget).length,
    };
  }

  // Cash Position & Cash Flow Metrics
  function todayDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
  }

  const demoPreparer = "preparer@fmis.example";
  const demoApprover = "approver@fmis.example";

  function recordOwner(record, kind) {
    if (record.createdByEmail) return record.createdByEmail.toLowerCase();
    const seedRecords = kind === "income" ? seedIncomeRecords : seedExpenseRecords;
    const key = kind === "income" ? "invoice" : "expenseId";
    return seedRecords.some((seed) => seed[key] === record[key]) ? demoPreparer : "";
  }

  function assignedApprover(request) {
    return (request.assignedApproverEmail || demoApprover).toLowerCase();
  }

  function expectedCollectionDate(record) {
    return record.expectedCollectionDate || record.dueDate || record.deliveryDate || "";
  }

  function nextInvoiceId(date, records) {
    const prefix = `INV-${date.slice(0, 4)}-`;
    const sequence = records.reduce((max, record) => {
      const reference = record.invoice.toUpperCase();
      const suffix = reference.slice(prefix.length);
      const number = Number(suffix);
      return reference.startsWith(prefix) && /^\d+$/.test(suffix) &&
        Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER
        ? Math.max(max, number) : max;
    }, 0);
    return prefix + String(sequence + 1).padStart(4, "0");
  }

  function getCollections(record) {
    // Existing demo and saved records only tracked a cumulative amount.
    return record.collections || (record.received > 0 ? [{ date: record.date, amount: record.received }] : []);
  }

  function paidDate(record) {
    return record.payableStatus === "Paid" ? record.paidDate || record.date : null;
  }

  function cashMovement(start, end) {
    let receipts = 0;
    let payments = 0;
    read(keys.income, []).forEach((record) => {
      getCollections(record).forEach(({ date, amount }) => {
        if (inDateRange(date, start, end)) receipts += toCents(amount);
      });
    });
    read(keys.expenses, []).forEach((record) => {
      if (inDateRange(paidDate(record), start, end)) payments += toCents(record.amount);
    });
    return { inflows: fromCents(receipts), outflows: fromCents(payments) };
  }

  function getCashFlowMetrics(periodObj) {
    const baseline = { date: "2026-09-01", amount: 5000000 };
    const start = periodObj.start || baseline.date;
    const prior = new Date(`${start}T00:00:00`);
    prior.setDate(prior.getDate() - 1);
    const before = cashMovement(baseline.date, todayDate(prior));
    const openingBalance = start >= baseline.date
      ? addMoney(baseline.amount, subMoney(before.inflows, before.outflows))
      : null;
    const { inflows, outflows } = cashMovement(start, periodObj.end);
    const netCashFlow = subMoney(inflows, outflows);
    return {
      openingCash: openingBalance,
      inflows, outflows, netCashFlow,
      closingCash: openingBalance === null ? null : addMoney(openingBalance, netCashFlow),
    };
  }

  // Receivables Aging
  function getReceivablesAging(asOfDate) {
    const today = asOfDate || todayDate();
    const records = read(keys.income, []);

    const buckets = [
      { key: "current", label: "Current (Not yet due)", count: 0, amount: 0, records: [] },
      { key: "d30", label: "1–30 Days Overdue", count: 0, amount: 0, records: [] },
      { key: "d60", label: "31–60 Days Overdue", count: 0, amount: 0, records: [] },
      { key: "d61", label: "61+ Days Overdue", count: 0, amount: 0, records: [] },
    ];

    const undated = { key: "undated", label: "Collection Date Unscheduled", count: 0, amount: 0, records: [] };
    let totalARCents = 0;

    records.forEach((r) => {
      if (r.date > today) return;
      const collected = getCollections(r).filter((item) => item.date <= today)
        .reduce((sum, item) => sum + toCents(item.amount), 0);
      const balCents = Math.max(0, toCents(r.amount) - collected);
      if (balCents <= 0) return;

      totalARCents += balCents;
      const bal = fromCents(balCents);
      const dueDate = expectedCollectionDate(r);
      const diffDays = Math.round((new Date(`${today}T00:00:00`) - new Date(`${dueDate}T00:00:00`)) / 86400000);

      let bucketIdx = 0;
      if (!dueDate) {
        undated.count++;
        undated.amount = addMoney(undated.amount, bal);
        undated.records.push({ ...r, balance: bal, daysOverdue: 0 });
        return;
      }
      if (diffDays <= 0) {
        bucketIdx = 0;
      } else if (diffDays <= 30) {
        bucketIdx = 1;
      } else if (diffDays <= 60) {
        bucketIdx = 2;
      } else {
        bucketIdx = 3;
      }

      buckets[bucketIdx].count++;
      buckets[bucketIdx].amount = addMoney(buckets[bucketIdx].amount, bal);
      buckets[bucketIdx].records.push({
        ...r,
        balance: bal,
        daysOverdue: Math.max(0, diffDays),
      });
    });

    return {
      asOfDate: today,
      totalAR: fromCents(totalARCents),
      buckets: undated.count ? [...buckets, undated] : buckets,
    };
  }

  // Payables Aging
  function getPayablesAging(asOfDate) {
    const today = asOfDate || todayDate();
    const records = read(keys.expenses, []);

    const buckets = [
      { key: "current", label: "Current (Not yet due)", count: 0, amount: 0, records: [] },
      { key: "d30", label: "1–30 Days Overdue", count: 0, amount: 0, records: [] },
      { key: "d60", label: "31–60 Days Overdue", count: 0, amount: 0, records: [] },
      { key: "d61", label: "61+ Days Overdue", count: 0, amount: 0, records: [] },
    ];

    let totalAPCents = 0;

    records.forEach((r) => {
      if (r.date > today || (paidDate(r) && paidDate(r) <= today)) return;
      const amtCents = toCents(r.amount);
      totalAPCents += amtCents;
      const amt = fromCents(amtCents);

      const dueDate = r.dueDate || r.date;
      const diffDays = Math.round((new Date(`${today}T00:00:00`) - new Date(`${dueDate}T00:00:00`)) / 86400000);

      let bucketIdx = 0;
      if (diffDays <= 0) {
        bucketIdx = 0;
      } else if (diffDays <= 30) {
        bucketIdx = 1;
      } else if (diffDays <= 60) {
        bucketIdx = 2;
      } else {
        bucketIdx = 3;
      }

      buckets[bucketIdx].count++;
      buckets[bucketIdx].amount = addMoney(buckets[bucketIdx].amount, amt);
      buckets[bucketIdx].records.push({
        ...r,
        balance: amt,
        daysOverdue: Math.max(0, diffDays),
      });
    });

    return {
      asOfDate: today,
      totalAP: fromCents(totalAPCents),
      buckets,
    };
  }

  // Payment Approvals Metrics
  function getPaymentApprovalMetrics() {
    const requests = read(keys.requests, []);
    let pendingCents = 0;
    let approvedCents = 0;
    let totalCents = 0;

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let returnedCount = 0;

    requests.forEach((req) => {
      const amtCents = toCents(req.amount);
      totalCents += amtCents;
      const st = String(req.status || "").toLowerCase();

      if (st.includes("pending") || st.includes("submitted")) {
        pendingCount++;
        pendingCents += amtCents;
      } else if (st.includes("approved")) {
        approvedCount++;
        approvedCents += amtCents;
      } else if (st.includes("rejected")) {
        rejectedCount++;
      } else if (st.includes("returned")) {
        returnedCount++;
      }
    });

    return {
      totalRequests: requests.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      returnedCount,
      pendingAmount: fromCents(pendingCents),
      approvedAmount: fromCents(approvedCents),
      totalAmount: fromCents(totalCents),
      requests,
    };
  }

  // Financial Indicators (Accurately distinguishes computable operational figures from uncomputable balance sheet ratios)
  function getFinancialIndicators(periodObj) {
    const inc = getIncomeMetrics(periodObj);
    const exp = getExpenseMetrics(periodObj);
    const arAging = getReceivablesAging();
    const apAging = getPayablesAging();

    const opResult = subMoney(inc.totalRevenue, exp.totalExpenses);
    const opWorkingCapital = subMoney(inc.outstandingAR, exp.outstandingAP);

    return [
      {
        category: "Operational / Transactional",
        name: "Net Receivables Less Payables",
        value: money(opWorkingCapital),
        unit: "PHP (₱)",
        computable: true,
        explanation: "Net operational liquidity from customer receivables minus open vendor payables (AR − AP). Full GAAP working capital requires balance sheet assets/liabilities.",
      },
      {
        category: "Operational / Transactional",
        name: "Recorded Revenue Less Expenses (%)",
        value: inc.totalRevenue > 0 ? `${((opResult / inc.totalRevenue) * 100).toFixed(1)}%` : "0.0%",
        unit: "%",
        computable: true,
        explanation: "Operational result divided by recorded invoiced revenue. Demonstrates period transactional operating profitability.",
      },
      {
        category: "Operational / Transactional",
        name: "Collection Efficiency Ratio",
        value: inc.totalRevenue > 0 ? `${((inc.totalCollected / inc.totalRevenue) * 100).toFixed(1)}%` : "0.0%",
        unit: "%",
        computable: true,
        explanation: "Proportion of total invoiced revenue successfully collected in cash.",
      },
      {
        category: "Liquidity (Financial Statement)",
        name: "Current Ratio",
        value: "N/A – Financial data unavailable",
        unit: "Ratio",
        computable: false,
        explanation: "Current Assets ÷ Current Liabilities. Requires inventory, short-term debt, and complete balance sheet accounts.",
      },
      {
        category: "Liquidity (Financial Statement)",
        name: "Cash Ratio",
        value: "N/A – Financial data unavailable",
        unit: "Ratio",
        computable: false,
        explanation: "Cash & Equivalents ÷ Current Liabilities. Unrecorded current obligations prevent valid calculation.",
      },
      {
        category: "Leverage (Financial Statement)",
        name: "Debt Ratio",
        value: "N/A – Financial data unavailable",
        unit: "%",
        computable: false,
        explanation: "Total Liabilities ÷ Total Assets × 100. Balance sheet total assets and total liabilities are not maintained in prototype.",
      },
      {
        category: "Leverage (Financial Statement)",
        name: "Debt-to-Equity Ratio",
        value: "N/A – Financial data unavailable",
        unit: "Ratio",
        computable: false,
        explanation: "Total Liabilities ÷ Total Equity. Stockholders' equity accounts are unavailable.",
      },
      {
        category: "Profitability (Financial Statement)",
        name: "Gross Profit Margin",
        value: "N/A – Financial data unavailable",
        unit: "%",
        computable: false,
        explanation: "Gross Income ÷ Net Sales × 100. Cost of Goods Sold (COGS) is not recorded in the transaction prototype.",
      },
      {
        category: "Profitability (Financial Statement)",
        name: "Net Profit Margin",
        value: "N/A – Financial data unavailable",
        unit: "%",
        computable: false,
        explanation: "Net Income ÷ Net Sales × 100. Requires audited Net Income statement with tax, financing, and depreciation.",
      },
      {
        category: "Profitability (Financial Statement)",
        name: "Return on Assets (ROA)",
        value: "N/A – Financial data unavailable",
        unit: "%",
        computable: false,
        explanation: "Net Income ÷ Total Assets × 100. Balance sheet total assets are not maintained.",
      },
      {
        category: "Profitability (Financial Statement)",
        name: "Return on Equity (ROE)",
        value: "N/A – Financial data unavailable",
        unit: "%",
        computable: false,
        explanation: "Net Income ÷ Total Equity × 100. Shareholder equity accounts are not maintained.",
      },
      {
        category: "Efficiency (Financial Statement)",
        name: "Asset Turnover",
        value: "N/A – Financial data unavailable",
        unit: "Ratio",
        computable: false,
        explanation: "Net Sales ÷ Total Assets. Total asset ledger is not maintained in prototype.",
      },
    ];
  }

  // Financial Alerts Engine
  function getAlerts() {
    const alerts = [];
    const today = todayDate();

    // 1. Low Cash Alert (Threshold ₱3,000,000)
    const forecast = getCashForecast(13, 3000000);
    const lowWeeks = forecast.filter((w) => w.low);
    if (lowWeeks.length > 0) {
      const first = lowWeeks[0];
      alerts.push({
        id: "alert-low-cash",
        type: "danger",
        icon: "!",
        title: "Low Cash Threshold Warning",
        message: `Projected closing cash falls below ₱3,000,000 threshold in Week ${first.week} (${money(first.closing)}). Immediate liquidity planning required.`,
        module: "cashforecast",
        link: "cashforecast.html",
        actionLabel: "View Cash Forecast",
      });
    }

    // 2. Budget Overspending Alert
    const budgets = getBudgetMetrics(parsePeriod("2026-10"));
    const overruns = budgets.categories.filter((c) => c.isOverBudget);
    if (overruns.length > 0) {
      const top = overruns.sort((a, b) => a.variance - b.variance)[0]; // Most negative variance
      alerts.push({
        id: "alert-budget-overrun",
        type: "warning",
        icon: "!",
        title: "Budget Overspending Alert",
        message: `${top.category} expenses exceeded allocated budget by ${money(Math.abs(top.variance))} (${top.utilization.toFixed(1)}% utilized).`,
        module: "budgets",
        link: "budgets.html",
        actionLabel: "View Budgets",
      });
    }

    // 3. Overdue Receivables Alert
    const arAging = getReceivablesAging(today);
    const overdueAR = arAging.buckets[1].amount + arAging.buckets[2].amount + arAging.buckets[3].amount;
    const overdueARCount = arAging.buckets[1].count + arAging.buckets[2].count + arAging.buckets[3].count;
    if (overdueARCount > 0) {
      alerts.push({
        id: "alert-overdue-ar",
        type: "info",
        icon: "i",
        title: "Overdue Customer Invoices",
        message: `${overdueARCount} invoice${overdueARCount === 1 ? "" : "s"} past due totaling ${money(overdueAR)}. Follow-up collection recommended.`,
        module: "income",
        link: "income.html",
        actionLabel: "View Invoices",
      });
    }

    // 4. Overdue Payables Alert
    const apAging = getPayablesAging(today);
    const overdueAP = apAging.buckets[1].amount + apAging.buckets[2].amount + apAging.buckets[3].amount;
    const overdueAPCount = apAging.buckets[1].count + apAging.buckets[2].count + apAging.buckets[3].count;
    if (overdueAPCount > 0) {
      alerts.push({
        id: "alert-overdue-ap",
        type: "warning",
        icon: "!",
        title: "Overdue Vendor Payables",
        message: `${overdueAPCount} payable${overdueAPCount === 1 ? "" : "s"} past due totaling ${money(overdueAP)}. Review vendor terms to prevent penalties.`,
        module: "expenses",
        link: "expenses.html",
        actionLabel: "View Payables",
      });
    }

    // 5. Pending Approvals Alert
    const approvals = getPaymentApprovalMetrics();
    if (approvals.pendingCount > 0) {
      alerts.push({
        id: "alert-pending-approvals",
        type: "info",
        icon: "i",
        title: "Pending Payment Approvals",
        message: `${approvals.pendingCount} payment request${approvals.pendingCount === 1 ? "" : "s"} pending review totaling ${money(approvals.pendingAmount)}.`,
        module: "approvals",
        link: "approvals.html",
        actionLabel: "Review Approvals",
      });
    }

    return alerts;
  }

  // 13-Week Cash Forecast Engine
  function getCashForecast(weekCount = 13, minimumBalance = 3000000) {

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const openingBalance = getCashFlowMetrics({ start: todayDate(today), end: todayDate(today) }).closingCash;

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
        items: [],
      };
    });

    function addToWeek(dateValue, amount, field, reference, party) {
      if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return;
      const dueDate = new Date(`${dateValue}T00:00:00`);
      if (Number.isNaN(dueDate.valueOf())) return;

      const weekIndex = weeks.findIndex((week) => dueDate <= week.end);
      if (weekIndex >= 0) {
        weeks[weekIndex][field] = addMoney(weeks[weekIndex][field], amount);
        weeks[weekIndex].items.push({ date: dateValue, amount, field, reference, party });
      }
    }

    // Populate from unpaid/partial income receivables
    read(keys.income, []).forEach((r) => {
      if (r.date > todayDate(today)) return;
      const collected = getCollections(r).filter(({ date }) => date <= todayDate(today))
        .reduce((sum, { amount }) => addMoney(sum, amount), 0);
      const bal = subMoney(r.amount, collected);
      if (bal > 0) {
        addToWeek(expectedCollectionDate(r), bal, "receipts", r.invoice, r.customer);
      }
    });

    // Populate from open expense payables
    read(keys.expenses, []).forEach((r) => {
      if (r.date <= todayDate(today) && (!paidDate(r) || paidDate(r) > todayDate(today)) && r.amount > 0) {
        addToWeek(r.dueDate || r.date, r.amount, "payments", r.expenseId, r.vendor);
      }
    });

    let runningCash = openingBalance;
    return weeks.map((w) => {
      const rec = w.receipts;
      const pay = w.payments;
      const net = subMoney(rec, pay);
      const close = addMoney(runningCash, net);

      const forecastWeek = {
        ...w,
        opening: runningCash,
        receipts: rec,
        payments: pay,
        netCashFlow: net,
        closing: close,
        low: close < minimumBalance,
      };

      runningCash = close;
      return forecastWeek;
    });
  }

  // Backward-compatible summarize()
  function summarize(period = "2026-10") {
    const periodObj = parsePeriod(period);
    const inc = getIncomeMetrics(periodObj);
    const exp = getExpenseMetrics(periodObj);
    const approvals = getPaymentApprovalMetrics();
    const cash = 5000000 + inc.totalCollected - exp.paidExpenses;

    return {
      incomeTotal: inc.totalRevenue,
      collectedTotal: inc.totalCollected,
      expenseTotal: exp.totalExpenses,
      paidExpenseTotal: exp.paidExpenses,
      receivables: inc.outstandingAR,
      payables: exp.outstandingAP,
      pending: approvals.pendingCount,
      pendingAmount: approvals.pendingAmount,
      cash,
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".dashboard-topbar");
    const avatar = header?.querySelector(".user-avatar");
    const profile = header?.querySelector(".topbar-user");
    const toggle = header?.querySelector(".profile-toggle");
    if (!avatar || !profile || !toggle) return;

    const menu = document.createElement("details");
    menu.className = "profile-menu";
    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", "Account menu");
    const logout = document.createElement("a");
    logout.href = "login.html";
    logout.textContent = "Log out";
    avatar.before(menu);
    summary.append(avatar, profile, toggle);
    menu.append(summary, logout);

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        summary.focus();
      }
    });
  });

  // Logout listener
  // Force sign-in again for sessions created by the earlier single-admin prototype.
  if (
  typeof sessionStorage !== "undefined" &&
  getSession()?.role === "Administrator" &&
  !getSession()?.permissions?.includes("accounts")
) {
  sessionStorage.removeItem("fmisSession");
}

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('a[href="login.html"]')) return;
    if (getSession()) {
      try {
        logActivity({
          action: "Signed out",
          module: "Authentication",
          type: "Authentication",
          description: "User signed out of the system.",
        });
      } catch (err) {
        console.error("Sign-out activity logging error:", err);
      }
      sessionStorage.removeItem("fmisSession");
    }
  }, { capture: true });

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Export to global window.FMIS
  window.FMIS = {
    keys,
    read,
    write,
    escapeHtml,
    toCents,
    fromCents,
    addMoney,
    subMoney,
    money,
    formatPercent,
    getSession,
    getDisplayName,
    getInitials,
    logActivity,
    parsePeriod,
    getIncomeMetrics,
    getExpenseMetrics,
    getBudgetMetrics,
    getCashFlowMetrics,
    getCollections,
    recordOwner,
    assignedApprover,
    expectedCollectionDate,
    nextInvoiceId,
    todayDate,
    getReceivablesAging,
    getPayablesAging,
    getPaymentApprovalMetrics,
    getFinancialIndicators,
    getAlerts,
    getCashForecast,
    summarize,
  };
})();