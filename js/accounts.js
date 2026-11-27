(() => {
  const permissionsByRole = {
    "Bookkeeper": ["dashboard", "income", "transactions", "expenses"],
    "Approver": ["dashboard", "approvals", "audit"],
    "Management / Read-only": [
      "dashboard", "income", "transactions", "budgets",
      "cashforecast", "reports", "audit",
    ],
    "Administrator": [
      "dashboard", "income", "transactions", "expenses", "approvals",
      "budgets", "cashforecast", "reports", "audit", "accounts",
    ],
  };

  const demoAccounts = [
    {
      email: "preparer@fmis.example",
      password: "Prepare2026!",
      fullName: "Maria G. Santos",
      role: "Bookkeeper",
    },
    {
      email: "approver@fmis.example",
      password: "Approve2026!",
      fullName: "David L. Cruz",
      role: "Approver",
    },
    {
      email: "management@fmis.example",
      password: "Manage2026!",
      fullName: "Elena R. Reyes",
      role: "Management / Read-only",
    },
  ];

  const accountStorageKey = "fmisUserAccounts";

  function getAccounts() {
    return JSON.parse(localStorage.getItem(accountStorageKey) || "[]", window.FMIS.normalizeStoredRole);
  }

  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  async function hashPassword(password, salt) {
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: Uint8Array.from(salt),
        iterations: 600000,
        hash: "SHA-256",
      },
      passwordKey,
      256,
    );

    return Array.from(new Uint8Array(hash)).join(",");
  }

  async function authenticate(email, password) {
    const identifier = normalizeEmail(email);
    const demo = demoAccounts.find((account) => account.email === identifier);
    const account = demo || getAccounts().find((user) => user.email === identifier);

    if (!account || !Object.hasOwn(permissionsByRole, account.role)) {
      return null;
    }

    const matches = demo
      ? demo.password === password
      : account.hash === await hashPassword(password, account.salt);

    if (!matches) {
      return null;
    }

    return {
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      permissions: [...permissionsByRole[account.role]],
    };
  }

  function canCreateAccounts() {
    const session = window.FMIS.getSession();
    return session?.role === "Administrator" &&
      session.permissions?.includes("accounts");
  }

  async function saveAccount({ fullName, email, password, role }, administratorRequired) {
    if (administratorRequired && !canCreateAccounts()) {
      throw new Error("Administrator access is required.");
    }

    fullName = fullName.trim();
    email = normalizeEmail(email);

    if (
      !fullName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      !Object.hasOwn(permissionsByRole, role)
    ) {
      throw new Error("Enter a name, a valid email, and a password of at least 8 characters.");
    }

    if (!crypto.subtle) {
      throw new Error("Open FMIS through localhost to create an account.");
    }

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(password, salt);

    if (administratorRequired && !canCreateAccounts()) {
      throw new Error("Administrator access is required.");
    }

    const accounts = getAccounts();

    if ([...accounts, ...demoAccounts].some((account) => account.email === email)) {
      throw new Error("An account with that email already exists.");
    }

    accounts.push({ fullName, email, role, salt, hash });
    localStorage.setItem(accountStorageKey, JSON.stringify(accounts));

    if (administratorRequired) {
      window.FMIS.logActivity({
        action: "Created user account",
        module: "Administration",
        type: "Account",
        description: `Created ${email} with the ${role} role.`,
      });
    }
  }

  window.FMISAccounts = {
    authenticate,
    listApprovers: () => [...demoAccounts, ...getAccounts()]
      .filter(({ role }) => role === "Approver")
      .map(({ fullName, email }) => ({ fullName, email })),
    canCreateAccounts,
    createAccount: (details) => saveAccount(details, true),
    registerAccount: ({ fullName, email, password }) =>
      saveAccount({ fullName, email, password, role: "Administrator" }, false),
    roles: Object.keys(permissionsByRole),
  };
})();