const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const loginSubmit = loginForm.querySelector('button[type="submit"]');

const registerPanel = document.querySelector("#register-panel");
const registerForm = document.querySelector("#register-form");
const registerSubmit = registerForm.querySelector('button[type="submit"]');
const registerMessage = document.querySelector("#registration-message");
const showRegisterButton = document.querySelector("#show-register");
const backToLoginButton = document.querySelector("#back-to-login");

const heading = document.querySelector("#welcome-heading");
const description = document.querySelector("#auth-description");

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = !message;
}

function showRegistration(show) {
  loginPanel.hidden = show;
  registerPanel.hidden = !show;
  registerMessage.textContent = "";
  showLoginError("");

  heading.textContent = show ? "Create an account" : "Welcome back";
  description.textContent = show
    ? "New registrations receive Administrator access."
    : "Sign in to access your FMIS workspace.";

  if (show) {
    registerForm.elements.fullName.focus();
  } else {
    loginForm.elements.email.focus();
  }
}

showRegisterButton.addEventListener("click", () => showRegistration(true));

backToLoginButton.addEventListener("click", () => {
  registerForm.reset();
  showRegistration(false);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginSubmit.disabled) return;

  showLoginError("");
  registerMessage.textContent = "";
  loginSubmit.disabled = true;
  showRegisterButton.disabled = true;

  try {
    const { email, password } = Object.fromEntries(new FormData(loginForm));
    const account = await window.FMISAccounts.authenticate(email, password);

    if (!account) {
      showLoginError("Email address or password is incorrect.");
      return;
    }

    sessionStorage.setItem("fmisSession", JSON.stringify(account));

    try {
      window.FMIS.logActivity({
        action: "Signed in",
        module: "Authentication",
        type: "Authentication",
        description: "User signed in successfully.",
      });
    } catch (error) {
      sessionStorage.removeItem("fmisSession");
      throw error;
    }

    window.location.assign("dashboard.html");
  } catch {
    showLoginError("Unable to sign in. Open FMIS on localhost and try again.");
  } finally {
    loginSubmit.disabled = false;
    showRegisterButton.disabled = false;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (registerSubmit.disabled) return;

  const { fullName, email, password, confirmPassword } =
    Object.fromEntries(new FormData(registerForm));

  if (password !== confirmPassword) {
    registerMessage.textContent = "Passwords do not match.";
    registerForm.elements.confirmPassword.focus();
    return;
  }

  registerSubmit.disabled = true;
  backToLoginButton.disabled = true;
  registerMessage.textContent = "";

  try {
    await window.FMISAccounts.registerAccount({ fullName, email, password });

    registerForm.reset();
    loginForm.elements.email.value = email.trim().toLowerCase();
    loginForm.elements.password.value = "";

    showRegistration(false);
    registerMessage.textContent = "Administrator account created. Enter your password to sign in.";
    loginForm.elements.password.focus();
  } catch (error) {
    registerMessage.textContent = error.message;
  } finally {
    registerSubmit.disabled = false;
    backToLoginButton.disabled = false;
  }
});