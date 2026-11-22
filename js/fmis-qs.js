/*
 * fmis-qs.js
 * Shared helpers for the Transaction History and Expenses & Payables modules.
 *  1. Payables helpers - aging buckets and totals for the Payables Register
 *  2. Supporting-document store - keeps the real attached file in IndexedDB so it
 *     can be viewed again later (localStorage only holds file name/size metadata)
 * Exposes window.FMISQM.
 */
(function () {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;

  function toDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function todayValue() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Whole days from today until the due date (negative = overdue).
  function daysUntil(dueDate, today) {
    return Math.round((toDate(dueDate) - toDate(today || todayValue())) / DAY);
  }

  function isOutstanding(expense) {
    return expense.payableStatus !== "Paid";
  }

  // Payables aging buckets: not yet due, 1-30, 31-60, 61+ days overdue.
  function payablesAging(expenses, today) {
    const buckets = [
      { key: "current", label: "Not yet due", amount: 0, count: 0 },
      { key: "d30", label: "1-30 days overdue", amount: 0, count: 0 },
      { key: "d60", label: "31-60 days overdue", amount: 0, count: 0 },
      { key: "d61", label: "61+ days overdue", amount: 0, count: 0 },
    ];
    expenses.filter(isOutstanding).forEach((expense) => {
      const late = -daysUntil(expense.dueDate, today);
      const bucket = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : buckets[3];
      bucket.amount += Number(expense.amount) || 0;
      bucket.count += 1;
    });
    return buckets;
  }

  // Totals for the register's summary cards.
  function payablesSummary(expenses, today) {
    const open = expenses.filter(isOutstanding);
    const sum = (list) => list.reduce((total, e) => total + (Number(e.amount) || 0), 0);
    const overdue = open.filter((e) => daysUntil(e.dueDate, today) < 0);
    const dueSoon = open.filter((e) => {
      const d = daysUntil(e.dueDate, today);
      return d >= 0 && d <= 7;
    });
    const openTotal = sum(open);
    return {
      openCount: open.length,
      openTotal,
      overdueCount: overdue.length,
      overdueTotal: sum(overdue),
      dueSoonCount: dueSoon.length,
      dueSoonTotal: sum(dueSoon),
      overdueShare: openTotal > 0 ? sum(overdue) / openTotal : 0,
    };
  }

  /* ---- Supporting-document store (IndexedDB) ---- */
  const DB_NAME = "fmisSupportingDocs";
  const STORE = "files";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("This browser does not support IndexedDB."));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open document storage."));
    });
  }

  function withStore(mode, action) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const request = action(tx.objectStore(STORE));
          tx.oncomplete = () => { db.close(); resolve(request.result); };
          tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error("Document storage failed.")); };
        }),
    );
  }

  function saveDoc(key, file) {
    return withStore("readwrite", (store) =>
      store.put({ name: file.name, type: file.type, size: file.size, blob: file, savedAt: new Date().toISOString() }, key),
    );
  }

  function getDoc(key) {
    return withStore("readonly", (store) => store.get(key));
  }

  // Opens the stored file in a new tab. Resolves false if no file was stored for the key.
  function openDoc(key) {
    return getDoc(key).then((doc) => {
      if (!doc || !doc.blob) return false;
      const url = URL.createObjectURL(doc.blob);
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.name;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    });
  }

  /* ---- Formatting helpers ---- */
  const pesos = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function peso(amount) {
    return pesos.format(Number(amount) || 0);
  }

  function pct(value, digits) {
    return value === null || value === undefined || !Number.isFinite(value) ? "-" : `${(value * 100).toFixed(digits === undefined ? 1 : digits)}%`;
  }

  // Summary card: <div class="qm-kpi"><span>label</span><strong>value</strong><small>note</small></div>
  function kpi(label, value, note, tone) {
    const card = document.createElement("div");
    card.className = `qm-kpi${tone ? ` qm-kpi-${tone}` : ""}`;
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("strong");
    v.textContent = value;
    card.append(l, v);
    if (note) {
      const n = document.createElement("small");
      n.textContent = note;
      card.append(n);
    }
    return card;
  }

  window.FMISQM = { daysUntil, todayValue, isOutstanding, payablesAging, payablesSummary, saveDoc, getDoc, openDoc, peso, pct, kpi };
})();