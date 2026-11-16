// FMIS registration UI prototype. Do not store passwords in browser storage.
// Connect this form to a server-side registration endpoint before creating real accounts.
(() => {
  "use strict";

  const form = document.querySelector("#register-form");
  const nameInput = document.querySelector("#register-name");
  const emailInput = document.querySelector("#register-email");
  const passwordInput = document.querySelector("#register-password");
  const verifyInput = document.querySelector("#register-confirm");
  const toggle = document.querySelector("#show-passwords");
  const feedback = document.querySelector("#register-feedback");

  function showFeedback(message, state) {
    feedback.textContent = message;
    feedback.dataset.state = state;
    feedback.hidden = false;
  }

  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = "";
    verifyInput.setCustomValidity("");
  }

  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", clearFeedback);
  });

  toggle.addEventListener("change", () => {
    const type = toggle.checked ? "text" : "password";
    passwordInput.type = type;
    verifyInput.type = type;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFeedback();

    nameInput.value = nameInput.value.trim();
    emailInput.value = emailInput.value.trim();
    if (!form.reportValidity()) return;

    if (passwordInput.value !== verifyInput.value) {
      showFeedback("The passwords do not match. Please try again.", "error");
      verifyInput.focus();
      return;
    }

    // Never claim account creation without a working server and database.
    showFeedback(
      "The registration form is valid. This is a prototype, so no account was created. Account registration will work after a secure backend is connected.",
      "success"
    );

    passwordInput.value = "";
    verifyInput.value = "";
    toggle.checked = false;
    passwordInput.type = "password";
    verifyInput.type = "password";
  });
})();
