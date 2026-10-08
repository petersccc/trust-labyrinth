/**
 * trust-labyrinth-worker.js
 * --------------------------
 * Cloudflare Worker for the Trust Labyrinth: receives the result-page
 * submission and creates or updates a task in ClickUp's "Lead Magnet"
 * list (inside the "Projekte" folder). Its own Worker, separate from the
 * two checkup Workers, but the same list, fields and ref code logic.
 * The ClickUp API token is read from env.CLICKUP_API_TOKEN, a Worker
 * secret, never hardcoded here and never present in the site's code.
 *
 * Logic (same as the checkups):
 *   - If the page URL had a `ref` parameter, search the list for a task
 *     whose "Ref Code" field matches it.
 *     - If found: update that task, set E-Mail to the submitted email and
 *       check "Check-up completed". Version is set to "Trust Labyrinth"
 *       only if it is empty; a Version already set is never overwritten.
 *       Source, Outreach Date, the task name and the existing
 *       description are left untouched; the
 *       labyrinth answers are added as a comment instead, so outreach
 *       notes already in the description are never overwritten.
 *   - If there was no `ref` parameter, or no task matched it: create a
 *     new task named after the company, with the answers as its
 *     description, E-Mail and Company filled in, Version set to "Trust
 *     Labyrinth", Source set to "Cold", and "Check-up completed" checked.
 *
 * IDs below were looked up against the live "Lead Magnet" list via the
 * ClickUp API on 2026-10-08. The Version field is set by option ID, so
 * renaming an option in ClickUp does not break it; deleting and
 * re-adding an option or field would.
 */

// "Lead Magnet" list, inside the "Projekte" folder, in the Team-Space workspace.
const LIST_ID = "901219622537";

// Custom field IDs on that list.
const FIELD_EMAIL = "c342330b-8efe-41e3-88e5-19d2126e6054"; // E-Mail (email)
const FIELD_SOURCE = "1e4c9e6f-f0eb-43b7-8ef1-e5084f62ffac"; // Source (dropdown)
const FIELD_VERSION = "0f5799ba-0ec1-4c02-a3de-c268508937b6"; // Version (dropdown)
const FIELD_REF_CODE = "955d616f-172b-4b7c-b853-2f317f5fb146"; // Ref Code (short_text)
const FIELD_CHECKUP_COMPLETED = "7b096a97-b6ff-4a5c-ae34-8b358789e5e4"; // Check-up completed (checkbox)
const FIELD_COMPANY = "d2d67d9c-9e90-411c-8854-cf51b770d2c0"; // Company (short_text)

// Dropdown option UUIDs.
const VERSION_OPTION_TRUST_LABYRINTH = "e7d6c4ab-1182-4961-8d12-7183e8a3216f";
const SOURCE_OPTION_COLD = "d533f592-a027-4914-8bd0-8cd4a0d89dd1";

const CLICKUP_API = "https://api.clickup.com/api/v2";

const LANG_NAMES = { de: "German", en: "English", zh: "Chinese" };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    const token = env.CLICKUP_API_TOKEN;
    if (!token) {
      // The secret hasn't been set yet, see worker/README.md.
      return jsonResponse({ ok: false, error: "Server misconfigured: missing ClickUp token" }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const email = clean(body.email, 200);
    const companyName = clean(body.companyName, 200);
    const refCode = clean(body.refCode, 100);

    if (!email || !companyName) {
      return jsonResponse({ ok: false, error: "email and companyName are required" }, 400);
    }

    const description = buildDescription(body);

    try {
      const matchedTaskId = refCode ? await findTaskByRefCode(token, refCode) : null;

      if (matchedTaskId) {
        await setCustomField(token, matchedTaskId, FIELD_EMAIL, email);
        await setCustomField(token, matchedTaskId, FIELD_CHECKUP_COMPLETED, true);
        if (await isVersionEmpty(token, matchedTaskId)) {
          await setCustomField(token, matchedTaskId, FIELD_VERSION, VERSION_OPTION_TRUST_LABYRINTH);
        }
        await addComment(token, matchedTaskId, description);
        return jsonResponse({ ok: true, action: "updated", taskId: matchedTaskId });
      }

      const newTaskId = await createTask(token, companyName, description);
      await setCustomField(token, newTaskId, FIELD_EMAIL, email);
      await setCustomField(token, newTaskId, FIELD_COMPANY, companyName);
      await setCustomField(token, newTaskId, FIELD_VERSION, VERSION_OPTION_TRUST_LABYRINTH);
      await setCustomField(token, newTaskId, FIELD_SOURCE, SOURCE_OPTION_COLD);
      await setCustomField(token, newTaskId, FIELD_CHECKUP_COMPLETED, true);
      return jsonResponse({ ok: true, action: "created", taskId: newTaskId });
    } catch (err) {
      return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 502);
    }
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
  lines.push(stuck || "Nowhere: only positive cards selected");
  lines.push("");
  lines.push("STRENGTHS");
  if (strengths.length) strengths.forEach((s) => lines.push("- " + s));
  else lines.push("None marked");
  lines.push("");
  lines.push("WHAT THEY WOULD TRY FIRST");
  lines.push(freeText || "(left empty)");
  return lines.join("\n");
}

/**
 * Searches the Lead Magnet list for a task whose "Ref Code" custom field
 * equals refCode. Includes closed tasks, since a previously contacted
 * lead may already be marked done. Returns the first match's id, or null.
 */
async function findTaskByRefCode(token, refCode) {
  const filter = encodeURIComponent(
    JSON.stringify([{ field_id: FIELD_REF_CODE, operator: "=", value: refCode }])
  );
  const url = `${CLICKUP_API}/list/${LIST_ID}/task?include_closed=true&custom_fields=${filter}`;
  const res = await fetch(url, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(`ClickUp search failed (${res.status})`);
  const data = await res.json();
  const tasks = data.tasks || [];
  return tasks.length > 0 ? tasks[0].id : null;
}

/**
 * True when the task's Version dropdown has no option chosen. ClickUp
 * leaves `value` out (or null) for an unset dropdown.
 */
async function isVersionEmpty(token, taskId) {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}`, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(`ClickUp get task failed (${res.status})`);
  const data = await res.json();
  const field = (data.custom_fields || []).find((f) => f.id === FIELD_VERSION);
  return !field || field.value === undefined || field.value === null || field.value === "";
}

async function createTask(token, name, description) {
  const res = await fetch(`${CLICKUP_API}/list/${LIST_ID}/task`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`ClickUp create task failed (${res.status})`);
  const data = await res.json();
  return data.id;
}

async function addComment(token, taskId, commentText) {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}/comment`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ comment_text: commentText, notify_all: false }),
  });
  if (!res.ok) throw new Error(`ClickUp add comment failed (${res.status})`);
}

async function setCustomField(token, taskId, fieldId, value) {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}/field/${fieldId}`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`ClickUp set field ${fieldId} failed (${res.status})`);
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
