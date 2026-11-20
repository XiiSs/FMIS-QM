const demoAccounts = [
  // Each demo account is an administrator-level account in this single-admin system.
  {
    email: "preparer@fmis.example",
    password: "Prepare2026!",
    fullName: "Maria G. Santos",
    role: "Administrator",
    permissions: ["dashboard", "income", "transactions", "expenses", "approvals", "budgets", "cashforecast", "reports", "audit"],
  },
  {
    email: "approver@fmis.example",
    password: "Approve2026!",
    fullName: "David L. Cruz",
    role: "Administrator",
    permissions: ["dashboard", "income", "transactions", "expenses", "approvals", "budgets", "cashforecast", "reports", "audit"],
  },
  {
    email: "management@fmis.example",
    password: "Manage2026!",
    fullName: "Maria G. Santos",
    role: "Administrator",
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
const statusMessage = document.querySelector("#login-status");
const registeredUsersKey = "fmisRegisteredUsers";

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  statusMessage.textContent = "Account created. Sign in with your email or username.";
  statusMessage.hidden = false;
  document.querySelector("#email").value = params.get("email") || "";
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.removeItem("fmisSession");
  errorMessage.hidden = true;
  errorMessage.textContent = "";
  statusMessage.hidden = true;
  statusMessage.textContent = "";

  if (!loginForm.reportValidity()) {
    return;
  }

  const formData = new FormData(loginForm);
  const identifier = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  let registeredUsers = [];
  try {
    const savedUsers = localStorage.getItem(registeredUsersKey);
    registeredUsers = savedUsers ? JSON.parse(savedUsers) : [];
    if (!Array.isArray(registeredUsers)) {
      throw new Error("Stored accounts are not a list.");
    }
  } catch {
    errorMessage.textContent =
      "Saved account data could not be read. Clear this browser's prototype account data and try again.";
    errorMessage.hidden = false;
    return;
  }

  const account = demoAccounts.find(
    (candidate) =>
      candidate.email === identifier && candidate.password === password,
  ) || registeredUsers.find(
    (candidate) =>
      (candidate.email === identifier || candidate.username === identifier) &&
      candidate.password === password,
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
      username: account.username || "",
      fullName: account.fullName,
      role: account.role,
      permissions: account.permissions,
    }),
  );
  try {
    window.FMIS.logActivity({
      action: "Signed in",
      module: "Authentication",
      type: "Authentication",
      description: "User signed in successfully.",
    });
  } catch (error) {
    sessionStorage.removeItem("fmisSession");
    errorMessage.textContent = `Sign-in succeeded, but the activity could not be recorded: ${error.message}`;
    errorMessage.hidden = false;
    return;
  }
  window.location.assign("dashboard.html");
});