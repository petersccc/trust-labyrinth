/**
 * trust-labyrinth-worker.js
 * --------------------------
 * Cloudflare Worker for the Trust Labyrinth: receives the result-page
 * submission and saves the contact in Brevo, list "Trust Labyrinth"
 * (#14, folder "Lead magnets"), with COMPANY, LANGUAGE, LEAD_MAGNET and
 * REF_CODE. The full answers (rooms, stuck room, strengths, free text) go
 * to Katarina as a notification email, since they do not fit into contact
 * attributes. The Brevo API key is the Worker secret BREVO_API_KEY.
 * Live Worker: trust-labyrinth-backend.nachhilfe-kp.workers.dev.
 * (Until 19 Nov 2026 this created or updated a task in ClickUp.)
 */

const LIST_ID = 14;
const LEAD_MAGNET = "Trust Labyrinth";
const LANG_NAMES = { de: "German", en: "English", zh: "Chinese" };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

    const key = env.BREVO_API_KEY;
    if (!key) return jsonResponse({ ok: false, error: "Server misconfigured: missing Brevo key" }, 500);

    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400); }

    const email = clean(body.email, 200);
    const companyName = clean(body.companyName, 200);
    const refCode = clean(body.refCode, 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !companyName) {
      return jsonResponse({ ok: false, error: "email and companyName are required" }, 400);
    }

    const language = LANG_NAMES[body.lang] || clean(body.lang, 10) || "unknown";
    try {
      await saveToBrevo(key, email, LIST_ID, { COMPANY: companyName, LANGUAGE: language, LEAD_MAGNET, ...(refCode ? { REF_CODE: refCode } : {}) });
    } catch (err) {
      return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 502);
    }
    const description = buildDescription(body);
    await notify(key, `Trust Labyrinth: ${companyName} (${email})`, [
      "Company: " + companyName,
      "Email: " + email,
      "Ref code: " + (refCode || "-"),
      "",
      description,
      "",
      "Saved in Brevo, list \"Trust Labyrinth\" (folder Lead magnets).",
    ].join("\n"), email);
    return jsonResponse({ ok: true, action: "saved" });
  },
};

function clean(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

/**
 * Spec section 11: language used, the room order taken, the selected
 * card texts per room (in the visitor's language), the stuck room, the
 * strengths, the free text answer (if any) and the submission date.
 */
function buildDescription(body) {
  const lang = LANG_NAMES[body.lang] || clean(body.lang, 10);
  const rooms = Array.isArray(body.rooms) ? body.rooms.slice(0, 7) : [];
  const order = Array.isArray(body.order) ? body.order.slice(0, 7).map((n) => clean(n, 2)) : [];
  const strengths = Array.isArray(body.strengths) ? body.strengths.slice(0, 7).map((s) => clean(s, 300)) : [];
  const stuck = clean(body.stuckRoom, 200);
  const stuckRooms = Array.isArray(body.stuckRooms) ? body.stuckRooms.slice(0, 7) : [];
  const summary = clean(body.summary, 600);
  const freeText = clean(body.freeText, 2000);
  const date = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

  const lines = [];
  lines.push("TRUST LABYRINTH");
  lines.push("Language: " + lang);
  lines.push("Room order: " + order.join(", "));
  lines.push("Submitted: " + date + " (Berlin time)");
  lines.push("");
  lines.push("ANSWERS PER ROOM");
  rooms.forEach((r) => {
    const selected = Array.isArray(r.selected) ? r.selected.slice(0, 4) : [];
    lines.push(clean(r.position, 2) + ". " + clean(r.name, 200) + " (Room " + clean(r.number, 2) + ")");
    selected.forEach((c) => {
      lines.push("   - " + (c.positive ? "[strength] " : "") + clean(c.text, 300));
    });
  });
  lines.push("");
  lines.push("WHERE THEY GOT STUCK");
  if (stuckRooms.length) {
    stuckRooms.forEach((r) => {
      const n = Number(r.problemCards) || 0;
      lines.push(
        "- " + clean(r.name, 200) + " (Room " + clean(r.number, 2) + "): " +
        n + " problem card" + (n === 1 ? "" : "s") + (r.main ? "  [MAIN]" : "")
      );
    });
  } else {
    lines.push(stuck || "Nowhere: only positive cards selected");
  }
  if (summary) {
    lines.push("Summary shown: " + summary);
  }
  lines.push("");
  lines.push("STRENGTHS");
  if (strengths.length) strengths.forEach((s) => lines.push("- " + s));
  else lines.push("None marked");
  lines.push("");
  lines.push("WHAT THEY WOULD TRY FIRST");
  lines.push(freeText || "(left empty)");
  return lines.join("\n");
}

function corsHeaders() {
  return {
    // Tighten this to the site's real domain once it is live, rather
    // than leaving it open to any origin.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ---- Brevo (same helper in every lead magnet backend) ----
const BREVO = "https://api.brevo.com/v3/";
const NOTIFY_TO = "kontakt@peters-crosscultural.de";
const SENDER = "kontakt@peters-crosscultural.de";
function brevo(key, path, body) {
  return fetch(BREVO + path, { method: "POST", headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
}
async function saveToBrevo(key, email, listId, attributes) {
  const add = (attrs) => brevo(key, "contacts", { email, attributes: attrs, listIds: [listId], updateEnabled: true });
  let res = await add(attributes);
  if (res.status === 400) res = await add({}); // an attribute is unknown in Brevo: still save the contact
  if (!res.ok) throw new Error(`Brevo contact failed (${res.status})`);
}
async function notify(key, subject, text, replyTo) {
  try {
    const res = await brevo(key, "smtp/email", {
      sender: { name: "Lead magnets", email: SENDER }, to: [{ email: NOTIFY_TO }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}), subject, textContent: text,
    });
    if (!res.ok) console.log("Brevo notification failed", res.status, await res.text());
  } catch (e) { console.log("Brevo notification error", String(e)); }
}
