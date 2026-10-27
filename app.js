const STORAGE_KEYS = {
  inventory: "tamalesTolimensesInventoryV1",
  draft: "tamalesTolimensesDraftV1"
};

const FALLBACK_CONFIG = {
  brand: { name: "Tamales", accent: "Tolimenses", tagline: "TRADICIÓN QUE SE DISFRUTA" },
  whatsapp: "573181234567",
  address: "Calle 12 # 4-56, Ibagué, Tolima",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Calle%2012%20%234-56%2C%20Ibagu%C3%A9%2C%20Tolima",
  hours: {
    timezone: "America/Bogota",
    openDays: [4, 5, 6, 0],
    openDaysLabel: "Jueves a domingo",
    openHour: 7,
    closeHour: 22,
    openLabel: "7:00 a. m. – 10:00 p. m.",
    closedDaysLabel: "Lunes, martes y miércoles: cerrado."
  },
  products: [
    { type: "normal", name: "Tamal tolimense", variant: "Normal", price: 12000, stock: 18, active: true, description: "El sabor tradicional del Tolima.", emoji: "🌿" },
    { type: "picante", name: "Tamal tolimense", variant: "Picante", price: 12000, stock: 12, active: true, description: "La receta tradicional con un toque picante.", emoji: "🌶️" }
  ]
};

let config = structuredClone(FALLBACK_CONFIG);
let inventory = { normal: 18, picante: 12 };

let selectedVariant = "normal";

let quantities = {
  normal: 1,
  picante: 0
};
let currentScreen = "home";
let orderModalTimeout = null;
let storeStatus = { open: false, reason: "hours" };
let demoMode = new URLSearchParams(window.location.search).get("demo") || "";
let menuIsOpen = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function formatMoney(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function getProduct(type) {
  return config.products.find(product => product.type === type) || FALLBACK_CONFIG.products.find(product => product.type === type);
}

function getPrice(type) {
  return Number(getProduct(type)?.price) || 12000;
}

function getStock(type) {
  return Math.max(0, Number(inventory[type]) || 0);
}

function getTotalStock() {
  return getStock("normal") + getStock("picante");
}

function getTotalQuantity() {
  return quantities.normal + quantities.picante;
}

function getOrderTotal() {
  return (
    quantities.normal * getPrice("normal") +
    quantities.picante * getPrice("picante")
  );
}

function getBogotaDate() {
  // Construye una fecha de trabajo con los componentes del horario de Bogotá.
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
}

function isWithinBusinessHours() {
  const now = getBogotaDate();
  const openDays = config.hours.openDays;
  const hour = now.getHours();
  return openDays.includes(now.getDay()) &&
    hour >= Number(config.hours.openHour) &&
    hour < Number(config.hours.closeHour);
}

function getNextOpening() {
  const now = getBogotaDate();
  const openDays = config.hours.openDays;
  const candidate = new Date(now);
  candidate.setHours(Number(config.hours.openHour), 0, 0, 0);

  for (let offset = 0; offset <= 7; offset++) {
    candidate.setTime(now.getTime());
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(Number(config.hours.openHour), 0, 0, 0);

    if (openDays.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return candidate;
}

function formatOpening(date) {
  const day = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long"
  }).format(date);
  const time = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

function getStoreStatus() {
  // Estos modos solo sirven para presentar los diferentes estados del prototipo.
  if (demoMode === "agotado") {
    return { open: false, reason: "stock" };
  }
  if (demoMode === "horario") {
    return { open: false, reason: "hours" };
  }
  if (getTotalStock() <= 0) {
    return { open: false, reason: "stock" };
  }
  if (demoMode === "abierto") {
    return { open: true, reason: "open" };
  }
  if (!isWithinBusinessHours()) {
    return { open: false, reason: "hours" };
  }
  return { open: true, reason: "open" };
}

function loadInventoryFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.inventory);
    if (stored) {
      const parsed = JSON.parse(stored);
      inventory = {
        normal: Math.max(0, Number(parsed.normal) || 0),
        picante: Math.max(0, Number(parsed.picante) || 0)
      };
      return;
    }
  } catch (error) {
    console.warn("No se pudo leer el inventario de demostración.", error);
  }

  inventory = {
    normal: Number(getProduct("normal").stock) || 0,
    picante: Number(getProduct("picante").stock) || 0
  };
  saveInventoryToStorage();
}

function saveInventoryToStorage() {
  localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventory));
}

function loadDraft() {
  try {
    const draft = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.draft) || "{}"
    );

    // Recuperar las cantidades independientes de cada sabor.
    if (draft.quantities && typeof draft.quantities === "object") {
      quantities = {
        normal: Math.max(
          0,
          Math.floor(Number(draft.quantities.normal) || 0)
        ),

        picante: Math.max(
          0,
          Math.floor(Number(draft.quantities.picante) || 0)
        )
      };
    } else if (
      draft.variant === "normal" ||
      draft.variant === "picante"
    ) {
      // Compatibilidad con pedidos guardados por la versión anterior.
      quantities = {
        normal: 0,
        picante: 0
      };

      quantities[draft.variant] = Math.max(
        0,
        Math.floor(Number(draft.quantity) || 0)
      );
    }

    // Recuperar el sabor que estaba seleccionado.
    if (
      draft.selectedVariant === "normal" ||
      draft.selectedVariant === "picante"
    ) {
      selectedVariant = draft.selectedVariant;
    } else if (
      draft.variant === "normal" ||
      draft.variant === "picante"
    ) {
      selectedVariant = draft.variant;
    }

    // Recuperar las indicaciones del pedido.
    if (typeof draft.notes === "string") {
      $("#order-notes").value = draft.notes;
    }

  } catch (error) {
    console.warn(
      "No se pudo recuperar el borrador del pedido.",
      error
    );
  }
}


function saveDraft() {
  localStorage.setItem(
    STORAGE_KEYS.draft,
    JSON.stringify({
      selectedVariant,
      quantities,
      notes: $("#order-notes").value.trim()
    })
  );
}


function normalizeSelection() {

  // Ajustar las cantidades a las existencias de cada sabor.
  for (const type of ["normal", "picante"]) {

    quantities[type] = Math.min(
      getStock(type),
      Math.max(
        0,
        Math.floor(Number(quantities[type]) || 0)
      )
    );

  }

  // Si el sabor seleccionado está agotado,
  // seleccionar el otro cuando tenga existencias.
  if (getStock(selectedVariant) <= 0) {

    const other =
      selectedVariant === "normal"
        ? "picante"
        : "normal";

    if (getStock(other) > 0) {
      selectedVariant = other;
    }

  }

}

function renderStatus() {
  storeStatus = getStoreStatus();
  const banner = $("#home-status-banner");
  banner.classList.toggle("is-closed", !storeStatus.open);

  $("#home-status-title").textContent = storeStatus.open ? "ABIERTO AHORA" : "CERRADO";
  $("#home-status-icon").textContent = storeStatus.open ? "▣" : "×";

  if (storeStatus.open) {
    $("#home-status-detail").textContent = `${config.hours.openDaysLabel} · ${config.hours.openLabel}`;
  } else if (storeStatus.reason === "stock") {
    $("#home-status-detail").textContent = "Se agotaron las existencias de hoy.";
  } else {
    $("#home-status-detail").textContent = `${config.hours.openDaysLabel} · ${config.hours.openLabel}`;
  }

  renderClosedScreen();
}

function renderClosedScreen() {
  const next = getNextOpening();
  const nextText = formatOpening(next);

  if (storeStatus.reason === "stock") {
    $("#closed-heading").textContent = "CERRADO";
    $("#closed-subtitle").textContent = "¡Se agotaron los tamales!";
    $("#closed-reason-icon").textContent = "▣";
    $("#closed-reason-title").textContent = "Hoy se agotaron nuestras existencias";
    $("#closed-reason-detail").textContent = "Por ahora no tenemos tamales disponibles. Gracias por elegirnos.";
    $("#next-open-title").textContent = "Próxima apertura";
    $("#next-open-detail").textContent = nextText;
    $("#next-card-title").textContent = "¡Gracias por tu preferencia!";
    $("#next-card-detail").textContent = `Vuelve a visitarnos en nuestro próximo horario: ${nextText}.`;
  } else {
    $("#closed-heading").textContent = "CERRADO";
    $("#closed-subtitle").textContent = "¡Te esperamos pronto!";
    $("#closed-reason-icon").textContent = "▦";
    $("#closed-reason-title").textContent = "Nuestro horario de atención";
    $("#closed-reason-detail").textContent = `Atendemos ${config.hours.openDaysLabel.toLowerCase()}, de ${config.hours.openLabel}.`;
    $("#next-open-title").textContent = "Próxima apertura";
    $("#next-open-detail").textContent = nextText;
    $("#next-card-title").textContent = "Te esperamos pronto";
    $("#next-card-detail").textContent = `Podrás hacer tu pedido desde ${nextText}.`;
  }

  $("#location-address").textContent = config.address;
  $("#closed-map-link").href = config.mapsUrl;
  $("#location-map-link").href = config.mapsUrl;
}

function renderProductOptions() {
  for (const type of ["normal", "picante"]) {
    const button = $(`[data-variant="${type}"]`);
    const stock = getStock(type);
    const selected = selectedVariant === type;
    button.classList.toggle("is-selected", selected);
    button.disabled = stock <= 0 || !storeStatus.open;
    button.setAttribute("aria-pressed", String(selected));

    const label = type === "normal" ? $("#normal-stock-label") : $("#picante-stock-label");
    label.textContent = stock <= 0 ? "Agotado" : `${stock} disponible${stock === 1 ? "" : "s"}`;
  }

  const stock = getStock(selectedVariant);
  const stockLine = $("#selected-stock-line");
  stockLine.classList.toggle("is-out", stock <= 0);
  stockLine.classList.toggle("is-low", stock > 0 && stock <= 5);

  if (!storeStatus.open) {
    $("#selected-stock-text").textContent = storeStatus.reason === "stock"
      ? "No hay existencias disponibles."
      : "Los pedidos están cerrados por horario.";
  } else if (stock <= 0) {
    $("#selected-stock-text").textContent = "Este sabor está agotado. Elige el otro sabor.";
  } else if (stock <= 5) {
    $("#selected-stock-text").textContent = `¡Quedan pocas unidades! Disponibles: ${stock}.`;
  } else {
    $("#selected-stock-text").textContent = `${stock} unidades disponibles`;
  }
}

function renderSummary() {

  const price = getPrice(selectedVariant);
  const stock = getStock(selectedVariant);
  const selectedQuantity = quantities[selectedVariant];

  const totalQuantity = getTotalQuantity();
  const total = getOrderTotal();

  // Precios de la pantalla de producto.
  $("#home-price").textContent = formatMoney(
    getPrice("normal")
  );

  $("#product-price").textContent = formatMoney(price);

  // Cantidad del sabor actualmente seleccionado.
  $("#quantity-value").textContent = String(
    selectedQuantity
  );

  // Botones de cantidad.
  $("#quantity-minus").disabled =
    selectedQuantity <= 0 ||
    stock <= 0 ||
    !storeStatus.open;

  $("#quantity-plus").disabled =
    selectedQuantity >= stock ||
    stock <= 0 ||
    !storeStatus.open;

  // Construir el resumen de los sabores seleccionados.
  const summaryItems = $("#summary-items");

  summaryItems.replaceChildren();

  for (const type of ["normal", "picante"]) {

    const qty = quantities[type];

    // No mostrar sabores con cantidad cero.
    if (qty <= 0) continue;

    const product = getProduct(type);

    const variantLabel =
      product.variant ||
      (type === "picante" ? "Picante" : "Normal");

    const unitPrice = getPrice(type);
    const subtotal = qty * unitPrice;

    const row = document.createElement("article");

    row.className = "summary-product";

    const image = document.createElement("img");

    image.src = "assets/tamal-hero.jpg";

    image.alt = `${product.name} ${variantLabel}`;

    const copy = document.createElement("div");

    copy.className = "summary-product-copy";

    const title = document.createElement("strong");

    title.textContent =
      `${product.name} · ${variantLabel}`;

    const details = document.createElement("span");

    details.textContent =
      `Cantidad: ${qty} × ${formatMoney(unitPrice)}`;

    const subtotalElement = document.createElement("strong");

    subtotalElement.className = "summary-item-subtotal";

    subtotalElement.textContent = formatMoney(subtotal);

    copy.append(title, details);

    row.append(image, copy, subtotalElement);

    summaryItems.append(row);

  }

  // Mostrar un mensaje si todavía no hay productos seleccionados.
  if (totalQuantity === 0) {

    const emptyMessage = document.createElement("p");

    emptyMessage.className = "summary-empty";

    emptyMessage.textContent =
      "Aún no has seleccionado tamales.";

    summaryItems.append(emptyMessage);

  }

  // Cantidad total y precio final.
  $("#summary-quantity").textContent =
    `${totalQuantity} ${totalQuantity === 1 ? "unidad" : "unidades"
    }`;

  $("#summary-total").textContent = formatMoney(total);

  // Indicaciones del cliente.
  const notes = $("#order-notes").value.trim();

  $("#summary-notes-wrap").hidden = !notes;

  $("#summary-notes").textContent = notes;

  // Permitir continuar si hay al menos un producto válido.
  const canOrder =
    storeStatus.open &&
    totalQuantity > 0 &&
    quantities.normal <= getStock("normal") &&
    quantities.picante <= getStock("picante");

  $("#continue-order").disabled = !canOrder;

  $("#send-whatsapp").disabled = !canOrder;

  // Actualizar los botones de los sabores.
  renderProductOptions();

}

function showScreen(screenName, updateHistory = true) {
  if (screenName === "product" || screenName === "summary") {
    storeStatus = getStoreStatus();
    if (!storeStatus.open) screenName = "closed";
  }

  if (
    screenName === "summary" &&
    getTotalQuantity() <= 0
  ) {
    screenName = "product";
  }

  currentScreen = screenName;
  $$(".screen").forEach(screen => {
    const active = screen.id === `screen-${screenName}`;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });

  $("#back-button").hidden = !["product", "summary", "location"].includes(screenName);
  $("#menu-panel").hidden = true;
  menuIsOpen = false;
  $("#menu-toggle").setAttribute("aria-expanded", "false");

  if (screenName === "product" || screenName === "summary") renderSummary();
  if (screenName === "closed") renderClosedScreen();

  if (updateHistory) {
    const hash = screenName === "home" ? "inicio" : screenName === "product" ? "producto" : screenName === "summary" ? "pedido" : screenName === "location" ? "ubicacion" : "cerrado";
    history.replaceState(null, "", `#${hash}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleBack() {
  if (currentScreen === "summary") showScreen("product");
  else if (currentScreen === "product" || currentScreen === "location") {
    showScreen(storeStatus.open ? "home" : "closed");
  } else {
    showScreen("home");
  }
}

function handleNavigation(destination) {
  if (destination === "home") {
    showScreen(storeStatus.open ? "home" : "closed");
  } else if (destination === "product") {
    showScreen(storeStatus.open ? "product" : "closed");
  } else if (destination === "location") {
    showScreen("location");
  }
}

function changeQuantity(delta) {

  if (!storeStatus.open) return;

  const type = selectedVariant;

  const currentQuantity = quantities[type];

  const max = getStock(type);

  quantities[type] = Math.min(
    max,
    Math.max(0, currentQuantity + delta)
  );

  saveDraft();

  renderSummary();

}

// Mostrar confirmación del pedido.
function showOrderConfirmationModal() {

  const modal = $("#order-success-modal");

  if (!modal) return;

  clearTimeout(orderModalTimeout);

  modal.hidden = false;

  document.body.classList.add("modal-open");

  $("#order-modal-close").focus();

  // Cerrar automáticamente después de 5 segundos.
  orderModalTimeout = setTimeout(() => {
    closeOrderConfirmationModal();
  }, 5000);

}


// Cerrar el modal.
function closeOrderConfirmationModal() {

  const modal = $("#order-success-modal");

  if (!modal) return;

  modal.hidden = true;

  document.body.classList.remove("modal-open");

  clearTimeout(orderModalTimeout);

  orderModalTimeout = null;

}

// ========================================
// ENVIAR PEDIDO Y REINICIAR EL CARRITO
// ========================================

function sendWhatsAppOrder() {

  // Verificar si el negocio está abierto.
  storeStatus = getStoreStatus();

  if (!storeStatus.open) {

    renderStatus();
    showScreen("closed");

    return;
  }

  // Ajustar las cantidades según las existencias.
  normalizeSelection();

  const totalQuantity = getTotalQuantity();

  // Validar que exista al menos un producto.
  if (totalQuantity <= 0) {

    alert("Selecciona al menos un tamal para continuar.");

    showScreen("product");

    return;
  }

  // Obtener las indicaciones del cliente.
  const notes = $("#order-notes").value.trim();

  // Construir el mensaje del pedido.
  const messageLines = [

    "¡Hola! Quiero hacer un pedido de Ricos Tamales Luz:",

    ""

  ];

  // Incluir cada sabor seleccionado.
  for (const type of ["normal", "picante"]) {

    const qty = quantities[type];

    // Omitir los sabores que no fueron seleccionados.
    if (qty <= 0) continue;

    const product = getProduct(type);

    const variantLabel =
      product.variant ||
      (type === "normal" ? "Normal" : "Picante");

    const unitPrice = getPrice(type);

    const subtotal = qty * unitPrice;

    messageLines.push(
      `• ${product.name} (${variantLabel}): ` +
      `${qty} x ${formatMoney(unitPrice)} = ` +
      `${formatMoney(subtotal)}`
    );

  }

  // Agregar el total del pedido.
  messageLines.push(
    "",
    `Total de unidades: ${totalQuantity}`,
    `Total estimado: ${formatMoney(getOrderTotal())}`
  );

  // Agregar indicaciones, si existen.
  if (notes) {

    messageLines.push(
      "",
      `Indicaciones: ${notes}`
    );

  }

  messageLines.push(
    "",
    "Por favor, confirmen la disponibilidad y el valor del domicilio, si aplica."
  );

  const message = messageLines.join("\n");

  // Preparar la dirección de WhatsApp.
  const whatsappUrl =
    `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;

  // Abrir WhatsApp antes de realizar otras operaciones.
  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  // ========================================
  // LIMPIAR EL PEDIDO ANTERIOR
  // ========================================

  // Eliminar el borrador guardado.
  localStorage.removeItem(STORAGE_KEYS.draft);

  // Reiniciar las cantidades.
  quantities = {
    normal: 0,
    picante: 0
  };

  // Seleccionar el sabor inicial disponible.
  selectedVariant =
    getStock("normal") > 0
      ? "normal"
      : "picante";

  // Dejar una unidad inicial, como en el formulario original.
  if (getStock(selectedVariant) > 0) {

    quantities[selectedVariant] = 1;

  }

  // Limpiar las indicaciones anteriores.
  $("#order-notes").value = "";

  // Actualizar los datos de la interfaz.
  renderSummary();

  // Regresar a la pantalla de inicio.
  showScreen("home");

  // Mostrar el modal de confirmación.
  showOrderConfirmationModal();

}

function bindEvents() {
  $("#brand-home").addEventListener("click", event => {
    event.preventDefault();
    handleNavigation("home");
  });

  $("#back-button").addEventListener("click", handleBack);
  $("#menu-toggle").addEventListener("click", () => {
    menuIsOpen = !menuIsOpen;
    $("#menu-panel").hidden = !menuIsOpen;
    $("#menu-toggle").setAttribute("aria-expanded", String(menuIsOpen));
  });

  $$("[data-go]").forEach(button => {
    button.addEventListener("click", () => handleNavigation(button.dataset.go));
  });

  $("#home-menu-button").addEventListener("click", () => handleNavigation("product"));
  $("#home-cta").addEventListener("click", () => handleNavigation("product"));
  $("#continue-order").addEventListener("click", () => {
    saveDraft();
    renderSummary();
    showScreen("summary");
  });
  $("#edit-order").addEventListener("click", () => showScreen("product"));
  $("#send-whatsapp").addEventListener("click", sendWhatsAppOrder);
  // Cerrar el modal con el botón.
$("#order-modal-close").addEventListener(
  "click",
  closeOrderConfirmationModal
);


// Cerrar el modal al pulsar fuera de la tarjeta.
$("#order-success-modal").addEventListener(
  "click",
  event => {

    if (event.target.id === "order-success-modal") {
      closeOrderConfirmationModal();
    }

  }
);


// Cerrar el modal con Escape.
document.addEventListener("keydown", event => {

  if (
    event.key === "Escape" &&
    !$("#order-success-modal").hidden
  ) {

    closeOrderConfirmationModal();

  }

});
  $("#quantity-minus").addEventListener("click", () => changeQuantity(-1));
  $("#quantity-plus").addEventListener("click", () => changeQuantity(1));
  $("#order-notes").addEventListener("input", () => {
    saveDraft();
    renderSummary();
  });
  $("#location-back-menu").addEventListener("click", () => handleNavigation("product"));

  $$("[data-variant]").forEach(button => {

    button.addEventListener("click", () => {

      const type = button.dataset.variant;

      if (
        !storeStatus.open ||
        getStock(type) <= 0
      ) {
        return;
      }

      // Cambiar de sabor sin borrar las cantidades anteriores.
      selectedVariant = type;

      saveDraft();

      renderSummary();

    });

  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".menu-toggle") && !event.target.closest(".menu-panel")) {
      $("#menu-panel").hidden = true;
      menuIsOpen = false;
      $("#menu-toggle").setAttribute("aria-expanded", "false");
    }
  });
}

async function loadConfig() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar data.json");
    const loaded = await response.json();
    config = { ...FALLBACK_CONFIG, ...loaded };
  } catch (error) {
    // Respaldo para que el prototipo pueda seguir funcionando si se abre sin servidor local.
    config = structuredClone(FALLBACK_CONFIG);
    console.info("Se está usando la configuración de respaldo.", error.message);
  }
}

function renderBusinessInfo() {
  $("#location-address").textContent = config.address;
  $("#closed-map-link").href = config.mapsUrl;
  $("#location-map-link").href = config.mapsUrl;
  $("#footer-whatsapp").href = `https://wa.me/${config.whatsapp}`;
}

async function init() {
  await loadConfig();
  loadInventoryFromStorage();
  loadDraft();
  normalizeSelection();
  renderBusinessInfo();
  bindEvents();
  renderStatus();
  renderSummary();

  // Para la presentación, ?demo=abierto, ?demo=horario o ?demo=agotado
  // permiten mostrar cada estado sin crear un administrador.
  const initialStatus = getStoreStatus();
  showScreen(initialStatus.open ? "home" : "closed", false);

  // Revisa el horario periódicamente. No hay backend: el estado depende de la hora
  // de Bogotá y del inventario guardado en el navegador.
  setInterval(() => {
    const wasOpen = storeStatus.open;
    const previousReason = storeStatus.reason;
    renderStatus();
    if (wasOpen !== storeStatus.open || previousReason !== storeStatus.reason) {
      if (storeStatus.open && currentScreen === "closed") showScreen("home", false);
      if (!storeStatus.open && currentScreen !== "closed") showScreen("closed", false);
    }
    if (currentScreen === "product" || currentScreen === "summary") renderSummary();
  }, 30000);
}

init();

// ========================================
// PWA: INSTALACIÓN Y SERVICE WORKER
// ========================================

function initPWA() {

  const isStandalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true;

  // Si ya está instalada, no mostrar el botón.
  if (isStandalone) {
    registerServiceWorker();
    return;
  }

  // Crear el botón flotante.
  const installButton = document.createElement("button");

  installButton.id = "pwa-install-btn";

  installButton.className = "pwa-install-btn";

  installButton.type = "button";

  installButton.innerHTML = `
        <span aria-hidden="true">↓</span>
        Instalar aplicación
    `;

  installButton.setAttribute(
    "aria-label",
    "Instalar Ricos Tamales Luz"
  );

  document.body.appendChild(installButton);

  let deferredPrompt = null;

  // Registrar el evento sin mostrar el diálogo
  // automáticamente. Se abrirá al pulsar el botón.
  window.addEventListener(
    "beforeinstallprompt",
    event => {

      event.preventDefault();

      deferredPrompt = event;

    }
  );

  // Acción del botón.
  installButton.addEventListener(
    "click",
    async () => {

      if (deferredPrompt) {

        deferredPrompt.prompt();

        const choice =
          await deferredPrompt.userChoice;

        deferredPrompt = null;

        if (choice.outcome === "accepted") {

          installButton.hidden = true;

        }

        return;
      }

      // iPhone y iPad: instalación manual desde Safari.
      const isIOS =
        /iphone|ipad|ipod/i.test(
          window.navigator.userAgent
        );

      if (isIOS) {

        alert(
          "Para instalar Ricos Tamales Luz:\n\n" +
          "1. Abre esta página en Safari.\n" +
          "2. Pulsa el botón Compartir.\n" +
          "3. Selecciona Añadir a pantalla de inicio.\n" +
          "4. Confirma la instalación."
        );

        return;
      }

      alert(
        "Para instalar Ricos Tamales Luz:\n\n" +
        "Abre el menú de tu navegador y busca " +
        "'Instalar aplicación' o 'Añadir a pantalla de inicio'.\n\n" +
        "La opción depende del navegador y de que " +
        "el sitio cumpla los requisitos de instalación PWA."
      );

    }
  );

  // Ocultar el botón cuando la instalación finalice.
  window.addEventListener(
    "appinstalled",
    () => {

      installButton.hidden = true;

      deferredPrompt = null;

    }
  );

  registerServiceWorker();

}


// ========================================
// REGISTRO DEL SERVICE WORKER
// ========================================

function registerServiceWorker() {

  if (!("serviceWorker" in navigator)) {

    console.warn(
      "Este navegador no admite Service Workers."
    );

    return;
  }

  const isSecureContext =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecureContext) {

    console.warn(
      "El PWA requiere HTTPS o un entorno local compatible."
    );

    return;
  }

  window.addEventListener("load", async () => {

    try {

      const registration =
        await navigator.serviceWorker.register(
          "./sw.js",
          {
            scope: "./"
          }
        );

      console.log(
        "PWA registrado correctamente:",
        registration.scope
      );

    } catch (error) {

      console.error(
        "Error al registrar el PWA:",
        error
      );

    }

  });

}


// Inicializar PWA.
initPWA();
