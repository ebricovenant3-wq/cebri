(() => {
  const client = window.CEBRI_SUPABASE;
  const history = document.getElementById("orderHistory");
  const message = document.getElementById("profileMessage");
  const escapeText = value => String(value ?? "");
  if (!client) {
    history.textContent = "Accounts are not connected yet. Add the Supabase project URL and public anon key to backend-config.js.";
    document.getElementById("accountEmail").textContent = "Connect Supabase to enable your account.";
    document.getElementById("profileForm").hidden = true;
    return;
  }
  const signInUrl = new URL("auth.html", location.href).href;
  async function loadAccount() {
    const {data:{user}, error:authError} = await client.auth.getUser();
    if (authError || !user) { location.replace(signInUrl); return; }
    document.getElementById("accountEmail").textContent = user.email || "Signed in";
    const {data:profile, error:profileError} = await client.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
    if (profileError) { message.textContent = "Could not load your profile. Please check that the account database migration has been applied."; }
    else if (profile) {
      document.querySelector('[name="full_name"]').value = profile.full_name || "";
      document.querySelector('[name="phone"]').value = profile.phone || "";
    }
    const {data:orders, error:ordersError} = await client.from("orders").select("id, created_at, status, items").eq("customer_user_id", user.id).order("created_at", {ascending:false});
    history.replaceChildren();
    if (ordersError) { history.textContent = "Could not load quote history. Please check that the account database migration has been applied."; return; }
    if (!orders?.length) { history.textContent = "No quote requests yet. Requests you send while signed in will appear here."; return; }
    orders.forEach(order => {
      const article = document.createElement("article");
      article.className = "history-item";
      const heading = document.createElement("strong");
      heading.textContent = `Request CBR-${escapeText(order.id).slice(0, 8).toUpperCase()}`;
      const date = document.createElement("small");
      date.textContent = order.created_at ? new Date(order.created_at).toLocaleDateString() : "Date unavailable";
      const items = document.createElement("p");
      items.textContent = Array.isArray(order.items) ? order.items.map(item => `${item.name} × ${item.quantity}`).join(", ") : "Quote request";
      const status = document.createElement("span");
      status.textContent = escapeText(order.status || "received");
      article.append(heading, date, items, status);
      history.append(article);
    });
  }
  document.getElementById("profileForm").addEventListener("submit", async event => {
    event.preventDefault();
    const {data:{user}} = await client.auth.getUser();
    if (!user) { location.replace(signInUrl); return; }
    const form = new FormData(event.currentTarget);
    const {error} = await client.from("profiles").update({full_name:String(form.get("full_name") || "").trim(), phone:String(form.get("phone") || "").trim(), updated_at:new Date().toISOString()}).eq("id", user.id);
    message.textContent = error ? error.message : "Profile saved.";
  });
  document.getElementById("logoutButton").addEventListener("click", async () => {
    const {error} = await client.auth.signOut();
    if (!error) location.replace(new URL("index.html", location.href).href);
    else message.textContent = error.message;
  });
  loadAccount().catch(error => { history.textContent = error.message || "Could not load your account."; });
})();
