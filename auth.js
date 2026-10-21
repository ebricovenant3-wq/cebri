(() => {
  const client = window.CEBRI_SUPABASE;
  const form = document.getElementById("authForm");
  const message = document.getElementById("authMessage");
  let view = new URLSearchParams(location.search).get("view") === "reset" ? "reset" : "login";
  const field = id => document.getElementById(id);
  const pageUrl = name => new URL(name, location.href).href;
  const tell = text => { message.textContent = text; };

  function render() {
    const reset = view === "reset";
    const register = view === "register";
    field("authTabs").classList.toggle("hidden", reset);
    field("nameField").classList.toggle("hidden", !register);
    field("phoneField").classList.toggle("hidden", !register);
    field("emailField").classList.toggle("hidden", reset);
    field("passwordField").classList.toggle("hidden", reset);
    field("confirmField").classList.toggle("hidden", !reset);
    field("forgotPassword").classList.toggle("hidden", register || reset);
    field("authTitle").textContent = reset ? "Choose a new password" : register ? "Create your account" : "Welcome back";
    field("authIntro").textContent = reset ? "Set a new password for your Cebri account." : register ? "Save your profile and keep track of quote requests." : "Sign in to manage your profile and view quote requests.";
    field("authSubmit").textContent = reset ? "Update password" : register ? "Create account" : "Sign in";
    form.elements.password.autocomplete = register ? "new-password" : "current-password";
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  }

  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => { view = button.dataset.view; tell(""); render(); }));
  field("forgotPassword").addEventListener("click", async () => {
    if (!client) { tell("Sign-in is not connected yet. Add the Supabase project settings to backend-config.js."); return; }
    const email = form.elements.email.value.trim();
    if (!email) { tell("Enter your email address first."); form.elements.email.focus(); return; }
    const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo:pageUrl("auth.html?view=reset")});
    tell(error ? error.message : "If that email belongs to an account, a password reset link is on its way.");
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) { tell("Sign-in is not connected yet. Add the Supabase project URL and public anon key to backend-config.js."); return; }
    const data = new FormData(form);
    const button = field("authSubmit");
    button.disabled = true;
    tell("");
    try {
      if (view === "reset") {
        const password = String(data.get("new_password") || "");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const {error} = await client.auth.updateUser({password});
        if (error) throw error;
        location.href = pageUrl("account.html");
        return;
      }
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      if (view === "register") {
        const {data:result, error} = await client.auth.signUp({email, password, options:{data:{full_name:String(data.get("full_name") || "").trim(), phone:String(data.get("phone") || "").trim()}, emailRedirectTo:pageUrl("account.html")} });
        if (error) throw error;
        if (!result.session) { tell("Account created. Check your email to confirm it, then sign in."); return; }
      } else {
        const {error} = await client.auth.signInWithPassword({email, password});
        if (error) throw error;
      }
      location.href = pageUrl("account.html");
    } catch (error) { tell(error.message || "We could not complete that request."); }
    finally { button.disabled = false; }
  });
  if (client) client.auth.getSession().then(({data}) => { if (data.session && view !== "reset") location.replace(pageUrl("account.html")); });
  render();
})();
