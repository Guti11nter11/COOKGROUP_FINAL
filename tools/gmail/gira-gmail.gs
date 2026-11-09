/**
 * GIRA · lector de correos de preventa (Google Apps Script, en TU cuenta de Gmail).
 *
 * Qué hace: cada 5 minutos busca correos nuevos de preventas (códigos y enlaces de acceso) y los manda
 * a tu Worker de GIRA, que saca UN código y UN enlace por preventa y los pone en la ficha del artista.
 * Solo lee (no borra, no responde, no marca nada). Nunca guarda ni registra el contenido de los correos.
 *
 * Instalación (te la da también el comando /gmail en Discord, con tu clave):
 *   1. script.google.com → Nuevo proyecto → pega este archivo.
 *   2. Configuración del proyecto → Propiedades del script → GIRA_TOKEN = la clave de /gmail.
 *   3. Elige la función `instalar` → Ejecutar → acepta los permisos.
 * Para pararlo: elige `desinstalar` → Ejecutar.
 */

var GIRA_URL = "https://gira-core.eleven-snk-11.workers.dev/inbox";
var QUERY =
  'newer_than:2d -in:sent (presale OR preventa OR "pre-sale" OR "early access" OR "verified fan" OR "access code" OR prévente OR vorverkauf OR prevendita)';
var MAX_SEEN = 500;

function instalar() {
  desinstalar();
  ScriptApp.newTrigger("revisar").timeBased().everyMinutes(5).create();
  revisar();
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "revisar") ScriptApp.deleteTrigger(t);
  });
}

function revisar() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GIRA_TOKEN");
  if (!token) throw new Error("Falta la propiedad GIRA_TOKEN (usa /gmail en Discord).");
  var seen = JSON.parse(props.getProperty("GIRA_SEEN") || "[]");
  var seenSet = {};
  seen.forEach(function (id) { seenSet[id] = true; });

  var mails = [];
  GmailApp.search(QUERY, 0, 30).forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      var id = m.getId();
      if (seenSet[id]) return; // los correos duplicados o ya leídos no se vuelven a mandar
      mails.push({
        id: id,
        from: m.getFrom(),
        subject: m.getSubject() || "",
        date: m.getDate().toISOString(),
        text: (m.getPlainBody() || "").slice(0, 20000),
        links: enlaces(m.getBody() || ""),
      });
    });
  });
  if (!mails.length) return;

  for (var i = 0; i < mails.length; i += 8) {
    var lote = mails.slice(i, i + 8);
    var res = UrlFetchApp.fetch(GIRA_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ mails: lote }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) throw new Error("GIRA respondió " + res.getResponseCode() + " (¿clave correcta?)");
    lote.forEach(function (m) { seen.push(m.id); });
  }
  props.setProperty("GIRA_SEEN", JSON.stringify(seen.slice(-MAX_SEEN)));
}

/** Enlaces del HTML con su texto visible (para distinguir "Unlock tickets" de "Unsubscribe"). */
function enlaces(html) {
  var out = [];
  var re = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html)) && out.length < 200) {
    var href = m[1].replace(/&amp;/g, "&").trim();
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 120);
    if (/^https:\/\//i.test(href)) out.push({ text: text, href: href });
  }
  return out;
}
