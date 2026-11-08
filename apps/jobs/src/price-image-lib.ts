import { flag, money, type CountryPrices } from "@gira/core";

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Tarjeta de precios oficiales (HTML autocontenido) para convertirla en imagen: una columna por país
 * con sus zonas de la más cara a la más barata. Estética de la app (entrada de concierto). Pura.
 */
export function priceCardHtml(artist: string, tour: string | null, rows: CountryPrices[]): string {
  const cols = rows
    .map((c) => {
      const zones = [...c.zones].sort((a, b) => b.price - a.price);
      const body = zones.length
        ? zones.map((z) => `<li><span>${esc(z.name)}</span><b>${esc(money(z.price, c.currency))}</b></li>`).join("")
        : `<li class="range"><span>Desde</span><b>${esc(money(c.min, c.currency))}</b></li>${c.max > c.min ? `<li class="range"><span>Hasta</span><b>${esc(money(c.max, c.currency))}</b></li>` : ""}`;
      return `<section><h2><i>${flag(c.country)}</i>${esc(c.name)}</h2><ul>${body}</ul></section>`;
    })
    .join("");
  const n = Math.min(3, Math.max(1, rows.length));
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0F1C2E;font-family:Archivo,system-ui,sans-serif;color:#EBD9B4;width:${n * 360 + 80}px}
#card{padding:36px 40px 30px;border:2px dashed rgba(235,217,180,.25);margin:0;background:linear-gradient(160deg,#13253C,#0F1C2E)}
header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:26px;gap:20px}
h1{font-size:34px;font-weight:800;letter-spacing:-.5px;line-height:1.05}
h1 small{display:block;font-size:15px;font-weight:600;color:#3FC1A9;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
.tag{font-size:13px;color:rgba(235,217,180,.6);text-align:right;white-space:nowrap}
main{display:grid;grid-template-columns:repeat(${n},1fr);gap:22px}
section{background:rgba(235,217,180,.05);border:1px solid rgba(235,217,180,.12);border-radius:14px;padding:18px 18px 10px}
h2{font-size:18px;font-weight:800;letter-spacing:1px;margin-bottom:12px;display:flex;gap:10px;align-items:center}
h2 i{font-style:normal;font-size:24px}
li{list-style:none;display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid rgba(235,217,180,.1);font-size:16px}
li:first-child{border-top:0}
li span{color:rgba(235,217,180,.85)}
li b{color:#3FC1A9;font-weight:800;white-space:nowrap}
footer{margin-top:20px;font-size:12px;color:rgba(235,217,180,.45)}
</style></head><body><div id="card"><header><h1><small>Precios oficiales</small>${esc(artist)}${tour ? `<br><span style="font-size:20px;font-weight:600;opacity:.8">${esc(tour)}</span>` : ""}</h1><div class="tag">GIRA · solo información</div></header><main>${cols}</main><footer>Precio por entrada en la venta oficial. Pueden cambiar o añadirse gastos de gestión.</footer></div></body></html>`;
}
