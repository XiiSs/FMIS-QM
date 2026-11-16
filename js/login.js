const demoAccounts = [
  {
    email: "preparer@fmis.example",
    password: "Prepare2026!",
    role: "Finance Preparer",
    permissions: ["dashboard", "income", "transactions", "expenses", "budgets", "reports"],
  },
  {
    email: "approver@fmis.example",
    password: "Approve2026!",
    role: "Approver",
    permissions: ["dashboard", "approvals", "reports"],
  },
  {
    email: "management@fmis.example",
    password: "Manage2026!",
    role: "Management / Read-only",
    permissions: [
      "dashboard",
      "income",
      "transactions",
      "expenses",
      "approvals",
      "budgets",
      "cashforecast",
      "reports",
      "audit",
    ],
  },
];

const loginForm = document.querySelector("#login-form");
const errorMessage = document.querySelector("#login-error");

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.removeItem("fmisSession");
  errorMessage.hidden = true;
  errorMessage.textContent = "";

  if (!loginForm.reportValidity()) {
    return;
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const account = demoAccounts.find(
    (candidate) =>
      candidate.email === email && candidate.password === password,
  );

  if (!account) {
    errorMessage.textContent =
      "Email address or password is incorrect. No financial records were opened.";
    errorMessage.hidden = false;
    return;
  }

  sessionStorage.setItem(
    "fmisSession",
    JSON.stringify({
      email: account.email,
      role: account.role,
      permissions: account.permissions,
    }),
  );
  window.location.assign("dashboard.html");
});