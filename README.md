# FMIS-QM

## Login and signup prototype

Open `html/login.html` to sign in or register a prototype account. Self-registration creates an Administrator account, and Administrators can create Bookkeeper/Approver/Management accounts from the Dashboard. Accounts sign in with their email.

| Demo role | Email | Password |
|---|---|---|
| Bookkeeper | `preparer@fmis.example` | `Prepare2026!` |
| Approver | `approver@fmis.example` | `Approve2026!` |
| Management / Read-only | `management@fmis.example` | `Manage2026!` |

Successful sign-in stores the role and its module permissions in the browser session and opens `html/dashboard.html`. Invalid credentials display an error without opening the dashboard. The dashboard requires a valid session, shows October 2026 illustrative data only, and displays an empty state for reporting periods without data. All nine sidebar modules remain visible; modules outside a role's permissions are disabled. Prototype values are illustrative and are not connected to financial records or live authentication.

The Income workspace in `html/income.html` provides invoice entry, invoice search/filter/export, collection recording, and a category report. Bookkeeper sessions can edit invoices and record collections; Management / Read-only sessions can review the workspace without editing. Sample income records are stored in browser local storage for this prototype.

The Transaction History workspace in `html/transaction.html` provides a Revenue Entry form for Bookkeepers. It validates required fields, prevents duplicate transaction references, calculates balance due, and saves successful revenue entries with a transaction ID to the same prototype income records used by the Income workspace. Fully collected entries are labeled Received; partial and unpaid entries are labeled Partially Paid and Unpaid.

The Revenue Entry form's equally sized Reset, Save Revenue, and Show Transaction History controls link to the transaction list at `html/transaction-history.html`. The history page combines saved revenue entries with illustrative expenses and supports text search, date-range/category/type/status filters, sorting, and transaction detail inspection.

The Expenses workspace at `html/expenses.html` validates vendor, amount, category, dates and a required supporting document. New expenses receive an automatic reference matching their expense ID. Existing expense references are kept during corrections. It warns before saving a possible duplicate, saves a payable without automatically requesting payment, and exposes a separate Create Payment Request action after saving. Expense and payment-request metadata are stored in browser local storage; document contents are not uploaded or persisted.

The Approvals workspace at `html/approvals.html` opens submitted payment requests and their linked payable, supporting-document metadata, and decision history. Only the Approver demo role may approve, reject, or return a pending request; rejection and return require comments. Decisions update status/history only and never transfer funds. An illustrative pending request is shown when no payment-request data has been initialized.

The Budgets workspace at `html/budgets.html` compares the October 2026 administrator-configured illustrative allocations and actuals for Raw Materials, Operations, Transportation, Utilities, and Maintenance. Summary totals, variances, over-budget flags, chart, and alert update with the reporting period; periods without configured data show an empty state. The Cash Forecast workspace at `html/cashforecast.html` projects the next 13 weeks using unpaid balances from saved income records and unpaid expenses scheduled by due date. Each week shows opening cash, expected receipts, planned payments, net flow, and closing cash, with a chart and warnings when closing cash is below ₱3,000,000. Forecasts are estimates only and do not initiate or record payments.

The Financial Reports workspace at `html/reports.html` provides an October 2026 sample summary with income and expense totals, outstanding receivable/payable records, and category budget variances. Period and report-type selections control the generated view; other periods display an empty-data state. The ₱5,000,000 cash position is a recorded balance, not the Week 13 cash forecast. Print and Export PDF open the browser print dialog so the report can be printed or saved as PDF.

The Audit Trail workspace at `html/audit.html` shows filterable, paginated saved activity with timestamp, user and account, role, module, action, description, reference, and status change. Successful sign-ins, sign-outs, expense and income saves, collections, payment-request submissions, approval decisions, and blocked self-approval attempts are recorded in browser storage. Notifications are derived from pending requests, overdue unpaid expenses, and the current 13-week cash forecast. This browser-only prototype is not a secure production audit service; its records remain local to the browser. The page is read-only and does not make payments or change approval decisions.