// GIRA · app privada del propietario (PWA). Sin dependencias: WebAuthn, Push y un poco de DOM.
const $ = (sel, el = document) => el.querySelector(sel);
const view = $("#view");
const tabs = $("#tabs");
const MADRID = "Europe/Madrid";
const LONDON = "Europe/London";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hhmm = (iso, tz) => new Intl.DateTimeFormat("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const dayName = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const dayKey = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: MADRID }).format(new Date(iso));
const flag = (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");

function until(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "ya ha empezado";
  const m = Math.round(ms / 60000);
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `en ${h} h ${m % 60} min`;
  return `en ${Math.round(h / 24)} días`;
}

// ── Base64url ⇄ ArrayBuffer para WebAuthn ─────────────────────────────────────
const b64uToBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)).buffer;
const bufToB64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function api(path, body) {
  const res = await fetch(path, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
  return data;
}

async function register(setup) {
  const o = await api("/api/auth/register/options", { setup });
  const cred = await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: b64uToBuf(o.challenge),
      user: { ...o.user, id: b64uToBuf(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })),
    },
  });
  const r = cred.response;
  await api("/api/auth/register/verify", {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment,
    response: {
      clientDataJSON: bufToB64u(r.clientDataJSON),
      attestationObject: bufToB64u(r.attestationObject),
      transports: r.getTransports ? r.getTransports() : [],
    },
  });
}

async function login() {
  const o = await api("/api/auth/login/options", {});
  const cred = await navigator.credentials.get({
    publicKey: { ...o, challenge: b64uToBuf(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })) },
  });
  const r = cred.response;
  await api("/api/auth/login/verify", {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufToB64u(r.clientDataJSON),
      authenticatorData: bufToB64u(r.authenticatorData),
      signature: bufToB64u(r.signature),
      userHandle: r.userHandle ? bufToB64u(r.userHandle) : undefined,
    },
  });
}

// ── Pantalla de acceso ────────────────────────────────────────────────────────
async function gate() {
  tabs.hidden = true;
  const setup = new URLSearchParams(location.search).get("alta");
  const status = await api("/api/auth/status").catch(() => ({ registered: false }));
  const canRegister = !!setup;
  view.innerHTML = `
    <section class="gate">
      <div class="big">GIRA</div>
      <p>${canRegister ? "Registra este iPhone con Face ID. Solo hace falta una vez." : status.registered ? "Entra con Face ID." : "Abre el enlace de alta que GIRA publicó en el canal #estado de tu Discord."}</p>
      ${canRegister || status.registered ? `<button id="go">${canRegister ? "Registrar con Face ID" : "Entrar con Face ID"}</button>` : ""}
      <div class="msg" id="msg" role="status"></div>
    </section>`;
  const btn = $("#go");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    $("#msg").textContent = "";
    try {
      if (canRegister) await register(setup);
      else await login();
      history.replaceState(null, "", "/app/#ventas");
      start();
    } catch (e) {
      $("#msg").textContent = e.name === "NotAllowedError" ? "Cancelado. Pulsa de nuevo cuando quieras." : e.message;
      btn.disabled = false;
    }
  });
}

// ── Texto de las fichas (formato de Discord) a HTML ──────────────────────────
function inline(t) {
  let s = esc(t);
  s = s.replace(/\s·\s&lt;t:\d+:F&gt;/g, ""); // la hora ya va escrita al lado
  s = s.replace(/&lt;t:(\d+):[A-Za-z]&gt;/g, (_, n) => {
    const iso = new Date(Number(n) * 1000).toISOString();
    return `${dayName(iso)}, ${hhmm(iso, MADRID)}`;
  });
  s = s.replace(/&lt;#(\d+)&gt;/g, (_, id) => `<a href="https://discord.com/channels/${state.feed?.guildId}/${id}">Discord</a>`);
  s = s.replace(/\[([^\]]+)\]\((?:&lt;)?(https?:\/\/[^)\s]+?)(?:&gt;)?\)/g, (_, txt, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>").replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
  return s;
}
function discordToHtml(text) {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${inline(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${inline(line.slice(3))}</h2>`;
      if (line.startsWith("-# ")) return `<p class="subtext">${inline(line.slice(3))}</p>`;
      if (!line.trim()) return "";
      return `<p>${inline(line)}</p>`;
    })
    .join("");
}

// ── Vistas ───────────────────────────────────────────────────────────────────
const state = { feed: null };

function stub(s) {
  const cities = [...new Map(s.dates.map((d) => [d.city, `${flag(d.country)} ${d.city}`])).values()].join(", ");
  const soon = Date.parse(s.startsAt) - Date.now() < 48 * 3600e3;
  return `<a class="stub${Date.parse(s.startsAt) - Date.now() < 3600e3 ? " now" : ""}" href="#gira-${encodeURIComponent(s.artistId)}">
    <div class="time"><b>${hhmm(s.startsAt, MADRID)}</b><small>🇬🇧 ${hhmm(s.startsAt, LONDON)}</small></div>
    <div class="detail">
      <div class="artist">${esc(s.artist)}</div>
      <div class="label">${esc(s.label)}</div>
      <div class="where">${esc(cities)}</div>
      ${soon ? `<span class="count">${until(s.startsAt)}</span>` : ""}
    </div></a>`;
}

function ventas() {
  const slots = state.feed.slots;
  if (!slots.length) return `<h1>Próximas ventas</h1><p class="empty">No hay preventas ni ventas a la vista. Cuando se anuncie una, aparecerá aquí y te avisaré.</p>`;
  const days = new Map();
  for (const s of slots) days.set(dayKey(s.startsAt), [...(days.get(dayKey(s.startsAt)) || []), s]);
  return `<h1>Próximas ventas</h1><p class="lead">Horas de Madrid. Toca una para ver cómo entrar.</p>${[...days.values()]
    .map((list) => `<h2 class="day">${esc(dayName(list[0].startsAt))}</h2>${list.map(stub).join("")}`)
    .join("")}`;
}

function giras() {
  const sheets = state.feed.sheets;
  if (!sheets.length) return `<h1>Giras</h1><p class="empty">Ninguna gira con ventas por llegar ahora mismo.</p>`;
  const next = (id) => state.feed.slots.find((s) => s.artistId === id);
  return `<h1>Giras</h1><ul class="list">${sheets
    .map((g) => {
      const n = next(g.artistId);
      return `<li><a class="row" href="#gira-${encodeURIComponent(g.artistId)}"><b>${esc(g.name)}</b><span class="sub">${n ? `${esc(n.label)} · ${dayName(n.startsAt)}, ${hhmm(n.startsAt, MADRID)}` : "Ventas por confirmar"}</span></a></li>`;
    })
    .join("")}</ul>`;
}

function gira(id) {
  const g = state.feed.sheets.find((x) => x.artistId === id);
  if (!g) return `<a class="back" href="#giras">Volver a giras</a><p class="empty">Esta gira ya no tiene ventas por llegar.</p>`;
  return `<a class="back" href="#giras">Volver a giras</a><article class="sheet">${discordToHtml(g.messages.join("\n\n"))}</article>`;
}

const CAT = { tour_announced: "Gira nueva", extra_date: "Fecha extra", presale: "Preventa", signup: "Registro", on_sale: "A la venta", sold_out: "Agotado", price: "Precios" };
function noticias() {
  const news = state.feed.news;
  if (!news.length) return `<h1>Noticias</h1><p class="empty">Todavía no hay noticias guardadas.</p>`;
  return `<h1>Noticias</h1><ul class="list news">${news
    .map((n) => `<li><a class="row" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><span class="cat">${esc(CAT[n.category] || n.category)}</span><br><b>${esc(n.artist_name)}</b> · ${esc(n.summary)}</a></li>`)
    .join("")}</ul>`;
}

function ajustes() {
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  return `<h1>Ajustes</h1>
    <section class="panel"><h2>Notificaciones</h2>
      <p>${!standalone ? "Primero añade GIRA a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí." : perm === "granted" ? "Activadas en este iPhone. De noche solo suenan las urgentes." : "Avisos de preventas, recordatorios 1 h y 10 min antes y novedades de tus giras."}</p>
      <button id="push" ${!standalone || perm === "granted" ? "disabled" : ""}>${perm === "granted" ? "Notificaciones activadas" : "Activar notificaciones"}</button>
      <div class="msg" id="pmsg" role="status"></div></section>
    <section class="panel"><h2>Calendario</h2>
      <p>Todas las preventas en el calendario del iPhone, con aviso 10 min antes. Se actualiza solo.</p>
      <a class="button secondary" id="cal" href="#ajustes">Suscribirme al calendario</a></section>
    <section class="panel"><h2>Discord</h2>
      <p>Canales por artista, recordatorios y resúmenes de las 21:00 y las 08:00.</p>
      <a class="button secondary" href="https://discord.com/channels/${state.feed.guildId}">Abrir el servidor GIRA</a></section>`;
}

async function enablePush() {
  const msg = $("#pmsg");
  try {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Permiso denegado. Puedes cambiarlo en Ajustes del iPhone → Notificaciones → GIRA.");
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await api("/api/push/key");
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBuf(publicKey) }));
    await api("/api/push/subscribe", sub.toJSON());
    render();
  } catch (e) {
    msg.textContent = e.message;
  }
}

function render() {
  if (!state.feed) return;
  const h = decodeURIComponent(location.hash.slice(1)) || "ventas";
  const tab = h.startsWith("gira-") ? "giras" : h;
  for (const a of tabs.querySelectorAll("a")) {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  view.innerHTML = h.startsWith("gira-") ? gira(h.slice(5)) : h === "giras" ? giras() : h === "noticias" ? noticias() : h === "ajustes" ? ajustes() : ventas();
  $("#updated").textContent = `actualizado ${hhmm(state.feed.generatedAt, MADRID)}`;
  $("#push")?.addEventListener("click", enablePush);
  $("#cal")?.addEventListener("click", async (e) => {
    e.preventDefault();
    location.href = (await api("/api/calendar")).url;
  });
  window.scrollTo(0, 0);
}

async function load() {
  try {
    state.feed = await api("/api/feed");
    try { localStorage.setItem("gira-feed", JSON.stringify(state.feed)); } catch {}
  } catch (e) {
    if (e.status === 401) return gate();
    try { state.feed = JSON.parse(localStorage.getItem("gira-feed")); } catch {}
    if (!state.feed) {
      view.innerHTML = `<p class="empty">Sin conexión y sin datos guardados. Vuelve a abrir GIRA cuando tengas red.</p>`;
      return;
    }
  }
  tabs.hidden = false;
  render();
}

function start() {
  load();
}

window.addEventListener("hashchange", render);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && state.feed && load());
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
start();
