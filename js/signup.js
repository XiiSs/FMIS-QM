const signupForm = document.querySelector("#signup-form");
const errorMessage = document.querySelector("#signup-error");
const registeredUsersKey = "fmisRegisteredUsers";
const preparerPermissions = [
  "dashboard",
  "income",
  "transactions",
  "expenses",
  "approvals",
  "budgets",
  "cashforecast",
  "reports",
  "audit",
];

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  errorMessage.textContent = "";

  if (!signupForm.reportValidity()) {
    return;
  }

  const formData = new FormData(signupForm);
  const fullName = String(formData.get("fullName")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (!fullName) {
    errorMessage.textContent = "Enter your full name.";
    errorMessage.hidden = false;
    return;
  }

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

  const normalizedUsername = username.toLowerCase();
  const emailAlreadyUsed = registeredUsers.some(
    (user) => user && user.email === email,
  ) || demoAccountEmails.has(email);
  const usernameAlreadyUsed = registeredUsers.some(
    (user) => user && typeof user.username === "string" &&
      user.username.toLowerCase() === normalizedUsername,
  );

  if (emailAlreadyUsed || usernameAlreadyUsed) {
    errorMessage.textContent = emailAlreadyUsed
      ? "An account with this email already exists."
      : "This username is already taken.";
    errorMessage.hidden = false;
    return;
  }

  registeredUsers.push({
    email,
    fullName,
    username,
    password,
    role: "Administrator",
    permissions: preparerPermissions,
  });

  try {
    localStorage.setItem(registeredUsersKey, JSON.stringify(registeredUsers));
  } catch {
    errorMessage.textContent =
      "Your account could not be saved in this browser. Check available storage and try again.";
    errorMessage.hidden = false;
    return;
  }

  window.location.assign(`login.html?registered=1&email=${encodeURIComponent(email)}`);
});

const demoAccountEmails = new Set([
  "preparer@fmis.example",
  "approver@fmis.example",
  "management@fmis.example",
]);
