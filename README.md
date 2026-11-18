# FMIS-QM

## Login and signup prototype

Open `html/login.html` to view the responsive sign-in screen, or `html/signup.html` to create a prototype account using a full name, email, username, and password. Registered accounts are stored in browser local storage and receive the Finance Preparer role; they can sign in with their email or username. This is a front-end prototype only: credentials are not securely stored, and this flow is not suitable for real authentication. Do not use a real password.

| Demo role | Email | Password |
|---|---|---|
| Finance Preparer | `preparer@fmis.example` | `Prepare2026!` |
| Approver | `approver@fmis.example` | `Approve2026!` |
| Management / Read-only | `management@fmis.example` | `Manage2026!` |

Successful sign-in stores the role and its module permissions in the browser session and opens `html/dashboard.html`. Invalid credentials display an error without opening the dashboard. The dashboard requires a valid session, shows October 2026 illustrative data only, and displays an empty state for reporting periods without data. All nine sidebar modules remain visible; modules outside a role's permissions are disabled. Prototype values are illustrative and are not connected to financial records or live authentication.

The Income workspace in `html/income.html` provides invoice entry, invoice search/filter/export, collection recording, and a category report. Finance Preparer sessions can edit invoices and record collections; Management / Read-only sessions can review the workspace without editing. Sample income records are stored in browser local storage for this prototype.

The Transaction History workspace in `html/transaction.html` provides a Revenue Entry form for Finance Preparers. It validates required fields, prevents duplicate transaction references, calculates balance due, and saves successful revenue entries with a transaction ID to the same prototype income records used by the Income workspace. Fully collected entries are labeled Received; partial and unpaid entries are labeled Partially Paid and Unpaid.

The Revenue Entry form's equally sized Reset, Save Revenue, and Show Transaction History controls link to the transaction list at `html/transaction-history.html`. The history page combines saved revenue entries with illustrative expenses and supports text search, date-range/category/type/status filters, sorting, and transaction detail inspection.

The Expenses workspace at `html/expenses.html` validates vendor, amount, category, dates, invoice reference, and a required supporting document. It warns before saving a possible duplicate, saves a payable without automatically requesting payment, and exposes a separate Create Payment Request action after saving. Expense and payment-request metadata are stored in browser local storage; document contents are not uploaded or persisted.

The Approvals workspace at `html/approvals.html` opens submitted payment requests and their linked payable, supporting-document metadata, and decision history. Only the Approver demo role may approve, reject, or return a pending request; rejection and return require comments. Decisions update status/history only and never transfer funds. An illustrative pending request is shown when no payment-request data has been initialized.

The Budgets workspace at `html/budgets.html` compares the October 2026 administrator-configured illustrative allocations and actuals for Raw Materials, Operations, Transportation, Utilities, and Maintenance. Summary totals, variances, over-budget flags, chart, and alert update with the reporting period; periods without configured data show an empty state. The Cash Forecast workspace at `html/cashforecast.html` provides a 13-week illustrative cash projection with weekly receipts, planned payments, closing balance calculations, a ₱3,000,000 threshold, and a low-cash alert beginning in Week 10. Forecast amounts are estimates only and do not initiate or record payments.

The Financial Reports workspace at `html/reports.html` provides an October 2026 sample summary with income and expense totals, outstanding receivable/payable records, and category budget variances. Period and report-type selections control the generated view; other periods display an empty-data state. The ₱5,000,000 cash position is a recorded balance, not the Week 13 cash forecast. Print and Export PDF open the browser print dialog so the report can be printed or saved as PDF.

The Audit Trail workspace at `html/audit.html` is available to Management / Read-only and shows filterable, paginated sample activity, including saved expenses, approval decisions, a blocked self-approval attempt, a manually recorded external payment, and the Week 10 low-cash alert. Activity in saved expense and payment-request histories is included when available in browser storage. Sample history entries are illustrative; this prototype does not independently persist every user action. The page is read-only and does not make payments or change approval decisions.