const WHATSAPP_NUMBER = "2349054884121"; // International format, digits only; leave empty until verified.
const BUSINESS_EMAIL = "ebricovenant3@gmail.com"; // Used for order requests if WhatsApp is not configured.
// Enter verified account details here; the static checkout never displays them before review.
const BANK_TRANSFER_DETAILS = {bankName:"", accountName:"", accountNumber:""};
const CART_STORAGE_KEY = "cebri-cart-v1";

const products = [
  {id:1,name:"Luxury Blackout Curtains",category:"Curtains",badge:"Blackout",description:"A rich, light-blocking finish for restful bedrooms.",image:"assets/curtain-pleated-taupe.jpeg"},
  {id:2,name:"Elegant Sheer Curtains",category:"Curtains",badge:"Light & airy",description:"Softly filter daylight while keeping rooms bright.",image:"assets/curtains-corner-room.jpeg"},
  {id:3,name:"Roller Window Blinds",category:"Roller Blinds",badge:"Modern pick",description:"A clean, practical look with easy light control.",image:"https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&q=80"},
  {id:4,name:"Curtain Rod Set",category:"Accessories",badge:"Finishing touch",description:"Complete your curtains with a coordinated rod set.",image:"https://images.unsplash.com/photo-1735817559113-c52162e9db76?auto=format&fit=crop&w=700&q=80"},
  {id:5,name:"Roman Blinds",category:"Blinds",badge:"Soft folds",description:"Tailored folds bring warmth and structure to windows.",image:"https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=700&q=80"},
  {id:6,name:"Venetian Blinds",category:"Blinds",badge:"Adjustable light",description:"Tilt the slats to balance privacy and natural light.",image:"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=80"},
  {id:7,name:"Pleated Blinds",category:"Blinds",badge:"Contemporary",description:"A neat, compact style for a considered finish.",image:"https://images.unsplash.com/photo-1572423588856-935928d12270?auto=format&fit=crop&w=700&q=80"},
  {id:8,name:"Panel Track Blinds",category:"Blinds",badge:"For wide windows",description:"Smooth, sweeping panels suit larger windows and doors.",image:"https://images.unsplash.com/photo-1549020408-891ed06fc0c5?auto=format&fit=crop&w=700&q=80"},
  {id:9,name:"Motorized Blinds",category:"Blinds",badge:"Premium choice",description:"Enjoy effortless control with a motorized option.",image:"https://images.unsplash.com/photo-1751349268360-c684f83fb3da?auto=format&fit=crop&w=700&q=80"},
  {id:10,name:"Custom Curtain Design",category:"Curtains",badge:"Made to measure",description:"Choose a look for your room and let’s discuss your fit.",image:"assets/curtains-bedroom.jpeg"},
  {id:11,name:"Curtain Tieback Set",category:"Accessories",badge:"Finishing touch",description:"A simple detail to frame curtains beautifully.",image:"https://images.unsplash.com/photo-1768642682593-dafda67a3784?auto=format&fit=crop&w=700&q=80"},
  {id:12,name:"Textured Eyelet Curtains",category:"Curtains",badge:"Easy to hang",description:"A relaxed drape with a clean, contemporary finish.",image:"https://images.unsplash.com/photo-1699805135173-3087dab73dc9?auto=format&fit=crop&w=700&q=80"},
  {id:13,name:"Layered Day & Night Curtains",category:"Curtains",badge:"Layered look",description:"Pair a sheer layer with a heavier curtain for flexible light.",image:"https://images.unsplash.com/photo-1757382642762-e990760796d8?auto=format&fit=crop&w=700&q=80"},
  {id:14,name:"Wood-Look Venetian Blinds",category:"Blinds",badge:"Classic style",description:"Adjustable slats bring a timeless look to your windows.",image:"https://images.unsplash.com/photo-1486373645914-e93b96470634?auto=format&fit=crop&w=700&q=80"},
  {id:15,name:"Vertical Window Blinds",category:"Blinds",badge:"For wide windows",description:"A practical option for wide windows and patio doors.",image:"https://images.unsplash.com/photo-1556137199-bbf19796302d?auto=format&fit=crop&w=700&q=80"},
  {id:16,name:"Blackout Roller Blinds",category:"Roller Blinds",badge:"Light control",description:"A streamlined blind option for bedrooms and media rooms.",image:"https://images.unsplash.com/photo-1592736513142-85229f9d21ba?auto=format&fit=crop&w=700&q=80"},
  {id:17,name:"Linen-Style Curtains",category:"Curtains",badge:"Soft texture",description:"An understated textured look for a calm, natural room.",image:"https://images.unsplash.com/photo-1578500467296-441a11d5d55a?auto=format&fit=crop&w=700&q=80"},
  {id:18,name:"Curtain & Blind Installation",category:"Installation",badge:"By request",description:"Request a quote for professional measuring and installation.",image:"https://images.unsplash.com/photo-1741031469069-89ddc9177e5d?auto=format&fit=crop&w=700&q=80",service:true},
  {id:19,name:"Reef Ripple Ivory White Voile Curtain",category:"Curtains",badge:"Sheer voile",description:"An airy ivory voile with a subtle ripple texture that softly filters daylight.",image:"https://images.unsplash.com/photo-1771039621720-8e70947d9f37?auto=format&fit=crop&w=700&q=80"},
  {id:20,name:"Sand Linen-Look Curtains",category:"Curtains",badge:"Natural texture",description:"Warm sand tones and a relaxed linen-inspired texture for an inviting room.",image:"https://images.unsplash.com/photo-1771039621841-e514f10dcd13?auto=format&fit=crop&w=700&q=80"},
  {id:21,name:"Emerald Green Statement Curtains",category:"Curtains",badge:"Statement color",description:"A rich emerald finish that brings depth and a confident accent to your space.",image:"https://images.unsplash.com/photo-1771039621945-c79535c6361c?auto=format&fit=crop&w=700&q=80"},
  {id:22,name:"Burgundy Velvet-Look Curtains",category:"Curtains",badge:"Velvet look",description:"A deep burgundy, soft-touch look for a bold and elegant window finish.",image:"https://images.unsplash.com/photo-1771039621930-812911f55ba2?auto=format&fit=crop&w=700&q=80"},
  {id:23,name:"Zebra Day & Night Blinds",category:"Blinds",badge:"Adjustable light",description:"Alternating sheer and opaque bands let you shift between filtered light and privacy.",image:"https://images.unsplash.com/photo-1587812226208-37081e8c0ede?auto=format&fit=crop&w=700&q=80"},
  {id:24,name:"White Roller Blinds",category:"Roller Blinds",badge:"Clean & simple",description:"A crisp white roller blind for a bright, uncluttered window finish.",image:"https://images.unsplash.com/photo-1621861833244-18b75cc5e1ff?auto=format&fit=crop&w=700&q=80"},
  {id:25,name:"Charcoal Blackout Blinds",category:"Roller Blinds",badge:"Room darkening",description:"A contemporary charcoal shade designed for added privacy and light control.",image:"https://images.unsplash.com/photo-1595803471005-84c8655b7593?auto=format&fit=crop&w=700&q=80"},
  {id:26,name:"Aluminium Venetian Blinds",category:"Blinds",badge:"Adjustable slats",description:"Durable aluminium slats give precise control over daylight and privacy.",image:"https://images.unsplash.com/photo-1542128832-fc523fe99a96?auto=format&fit=crop&w=700&q=80"},
  {id:27,name:"Light-Grey Vertical Blinds",category:"Blinds",badge:"For wide windows",description:"Soft grey vertical slats suit wide windows and doors, with simple light adjustment.",image:"https://images.unsplash.com/photo-1622605058034-5cbf25d135de?auto=format&fit=crop&w=700&q=80"},
  {id:28,name:"Premium Curtain Hardware Set",category:"Accessories",badge:"Finishing touch",description:"Coordinate your window treatment with a polished set of curtain hardware.",image:"https://images.unsplash.com/photo-1766684412414-57b272c62d45?auto=format&fit=crop&w=700&q=80"},
  {id:29,name:"Soft Cream Blackout Curtains",category:"Curtains",badge:"Calm neutral",description:"A soft cream blackout option that pairs privacy with a light, versatile color.",image:"https://images.unsplash.com/photo-1771039621869-1aa0536712a9?auto=format&fit=crop&w=700&q=80"},
  {id:30,name:"Dusty Blue Linen-Look Curtains",category:"Curtains",badge:"Cool tone",description:"A muted blue shade with a relaxed woven look for a calm, tailored room.",image:"https://images.unsplash.com/photo-1771039621930-79b8bd39b7ce?auto=format&fit=crop&w=700&q=80"},
  {id:31,name:"Warm Grey Eyelet Curtains",category:"Curtains",badge:"Easy to hang",description:"A versatile warm grey with an easy eyelet heading and soft drape.",image:"https://images.unsplash.com/photo-1664112742438-28eb6a7a3777?auto=format&fit=crop&w=700&q=80"},
  {id:32,name:"Beige Zebra Blinds",category:"Blinds",badge:"Soft neutral",description:"Day-and-night striped fabric in a warm beige shade for adjustable privacy.",image:"https://images.unsplash.com/photo-1591001939596-4aa39d641830?auto=format&fit=crop&w=700&q=80"},
  {id:33,name:"Natural Oak-Look Venetian Blinds",category:"Blinds",badge:"Warm wood look",description:"Warm oak-inspired slats add natural character while keeping light adjustable.",image:"https://images.unsplash.com/photo-1584574551194-97e2bb555d41?auto=format&fit=crop&w=700&q=80"},
  {id:34,name:"Double Curtain Rod Set",category:"Accessories",badge:"Layer with ease",description:"Hang sheer and heavier curtains together with a coordinated double rod set.",image:"https://images.unsplash.com/photo-1530914507926-36d0f98a9f1f?auto=format&fit=crop&w=700&q=80"},
  {id:35,name:"Ceiling Curtain Track",category:"Accessories",badge:"Minimal finish",description:"A discreet track option for a clean ceiling-mounted curtain installation.",image:"https://images.unsplash.com/photo-1771039621785-e66430406532?auto=format&fit=crop&w=700&q=80"},
  {id:36,name:"Decorative Curtain Holdbacks",category:"Accessories",badge:"Finishing detail",description:"Frame an open window with a coordinated pair of decorative curtain holdbacks.",image:"https://images.unsplash.com/photo-1763718869063-41678d34069d?auto=format&fit=crop&w=700&q=80"},
  {id:37,name:"Taupe Pleated Curtains with Sheer Voile",category:"Curtains",badge:"Layered custom look",description:"Full-length taupe pleats paired with a soft white sheer voile and decorative tiebacks.",image:"assets/curtains-polished-product.png"}
];

const cart = new Map();
try {
  const savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
  savedCart.forEach(([id, quantity]) => {
    if (products.some(product => product.id === Number(id)) && Number.isInteger(quantity) && quantity > 0) cart.set(Number(id), quantity);
  });
} catch { /* Continue with an empty cart if browser storage is unavailable. */ }
const grid = document.getElementById("productsGrid");
const cartPanel = document.getElementById("cartPanel");
const cartItems = document.getElementById("cartItems");

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 2400);
}

function renderProducts(query = "") {
  const term = query.trim().toLowerCase();
  const matches = products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(term));
  const resultCount = document.getElementById("resultCount");
  if (resultCount) resultCount.textContent = `${matches.length} ${matches.length === 1 ? "product" : "products"}${term ? ` for “${query}”` : " in the collection"}`;
  grid.innerHTML = matches.length ? matches.map(product => `
    <article class="product">
      <div class="product-image"><img loading="lazy" src="${product.image}" alt="${product.name}"><span class="product-badge">${product.badge}</span></div>
      <div class="product-body">
        <p class="product-category">${product.category}</p>
        <h3>${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-bottom"><span class="quote-label">${product.service ? "Request service quote" : "Request a quote"}</span><button class="add-button" type="button" data-add="${product.id}" aria-label="Add ${product.name} to bag">Add to bag <span aria-hidden="true">+</span></button></div>
      </div>
    </article>`).join("") : '<div class="search-empty">No products match that search. Try another term.</div>';
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  document.getElementById("cartCount").textContent = count;
  if (!cart.size) {
    cartItems.innerHTML = '<div class="empty">Your bag is waiting for something lovely.<br>Explore the collection to get started.</div>';
    saveCart();
    return;
  }
  cartItems.innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const product = products.find(item => item.id === id);
    const quoteText = product.service ? "Service fee confirmed after review" : "Price confirmed after consultation";
    return `<div class="cart-item"><img src="${product.image}" alt=""><div><strong>${product.name}</strong><small>${quoteText}</small><div class="qty"><button type="button" data-qty="${id}" data-change="-1" aria-label="Decrease quantity">−</button><span>${quantity}</span><button type="button" data-qty="${id}" data-change="1" aria-label="Increase quantity">+</button></div></div><button class="remove-item" type="button" data-remove="${id}" aria-label="Remove ${product.name}">×</button></div>`;
  }).join("");
  saveCart();
}

function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.entries()])); }
  catch { /* The cart remains usable for this page if storage is unavailable. */ }
}

function renderBankTransferNote() {
  const note = document.getElementById("bankTransferNote");
  if (!note) return;
  const detailsReady = Object.values(BANK_TRANSFER_DETAILS).every(value => value.trim());
  note.textContent = detailsReady
    ? "Cebri will review your request and send the confirmed quote and bank-transfer instructions manually."
    : "Verified bank details have not been added yet. Cebri will review your request and share the quote and payment instructions manually.";
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  showToast("Added to your bag");
}

function orderOnWhatsApp(event) {
  event.preventDefault();
  if (!cart.size) { showToast("Add an item to your bag first"); return; }
  const form = document.getElementById("checkoutForm");
  if (!form.reportValidity()) return;
  const details = new FormData(form);
  const lines = [...cart.entries()].map(([id, quantity]) => `- ${products.find(item => item.id === id).name} × ${quantity}`);
  const message = `Hello Cebri Curtains & Blinds!\n\nI'd like you to review this order request:\n${lines.join("\n")}\n\nCustomer: ${details.get("name")}\nPhone: ${details.get("phone")}\nAddress: ${details.get("address") || "To be confirmed"}\nMeasurements / notes: ${details.get("notes") || "Not provided yet"}\nPreferred payment: ${details.get("payment")}\n\nPlease confirm measurements, fabric options, service availability, delivery and final quote. I will wait for your confirmation and bank details before making a transfer.`;
  if (WHATSAPP_NUMBER) {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    showToast("Order request opened in WhatsApp");
  } else if (BUSINESS_EMAIL) {
    window.location.href = `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent("Cebri order review request")}&body=${encodeURIComponent(message)}`;
  } else {
    showToast("Add a WhatsApp number or business email in script.js first");
  }
}

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(Number(button.dataset.add));
});
cartItems.addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-qty]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton) {
    const id = Number(quantityButton.dataset.qty);
    const next = (cart.get(id) || 0) + Number(quantityButton.dataset.change);
    if (next <= 0) cart.delete(id); else cart.set(id, next);
    renderCart();
  }
  if (removeButton) { cart.delete(Number(removeButton.dataset.remove)); renderCart(); }
});

document.getElementById("search").addEventListener("input", event => {
  document.querySelectorAll(".filter-button").forEach(button => button.classList.remove("active"));
  renderProducts(event.target.value);
});
document.querySelectorAll("[data-category]").forEach(link => link.addEventListener("click", () => {
  const category = link.dataset.category;
  document.getElementById("search").value = category;
  document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("active", button === link));
  renderProducts(category);
  document.getElementById("products").scrollIntoView({behavior:"smooth",block:"start"});
}));
document.getElementById("viewAll").addEventListener("click", () => {
  document.getElementById("search").value = "";
  document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("active", button.dataset.category === ""));
  renderProducts();
  document.getElementById("products").scrollIntoView({behavior:"smooth",block:"start"});
});
document.getElementById("cartButton").addEventListener("click", () => {
  cartPanel.classList.remove("hidden");
  document.getElementById("closeCart").focus();
});
function closeCart() { cartPanel.classList.add("hidden"); }
document.getElementById("closeCart").addEventListener("click", closeCart);
cartPanel.addEventListener("click", event => { if (event.target.matches("[data-close-cart]")) closeCart(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeCart(); });
document.getElementById("checkoutForm").addEventListener("submit", orderOnWhatsApp);
document.getElementById("menuToggle").addEventListener("click", event => {
  const nav = document.getElementById("mainNav");
  const open = nav.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => {
  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
}));
const whatsappLink = document.getElementById("whatsappLink");
whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}`;
whatsappLink.target = "_blank";
whatsappLink.rel = "noopener noreferrer";
const emailLink = document.getElementById("emailLink");
emailLink.href = `mailto:${BUSINESS_EMAIL}`;
emailLink.textContent = BUSINESS_EMAIL;
document.getElementById("year").textContent = new Date().getFullYear();
const initialCategory = new URLSearchParams(window.location.search).get("category") || "";
document.getElementById("search").value = initialCategory;
document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("active", button.dataset.category === initialCategory));
renderProducts(initialCategory);
renderCart();
renderBankTransferNote();
