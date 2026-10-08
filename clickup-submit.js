/**
 * clickup-submit.js
 * ------------------
 * Front-end side of the ClickUp integration, same pattern as the
 * checkups. On submit, this posts the result-page submission and any
 * `ref` URL parameter to the Trust Labyrinth's own Cloudflare Worker,
 * which holds the ClickUp API token (as a Worker secret, never present
 * in this site's code) and does the create-or-update logic against the
 * "Lead Magnet" list.
 *
 * This file does not talk to ClickUp directly and never sees the API
 * token. See worker/trust-labyrinth-worker.js for that.
 */

// TODO: set to the Worker's URL once it is deployed (worker/README.md).
const CLICKUP_WORKER_URL = "";

/**
 * Reads the `ref` query parameter from the current page URL, e.g.
 * https://example.com/?ref=48&lang=zh -> "48". Returns "" if absent.
 */
function getRefCodeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("ref") || "";
  } catch (e) {
    return "";
  }
}

/**
 * Posts the submission to the Cloudflare Worker. Best effort, like the
 * checkups: failures are logged to the console but never block the
 * visitor, who still reaches the thank you slide.
 */
async function submitToWorker(submission) {
  const payload = { ...submission, refCode: getRefCodeFromUrl() };

  if (!CLICKUP_WORKER_URL) {
    console.warn("[clickup-submit] No Worker URL set yet; submission not sent:", payload);
    return { ok: false };
  }

  try {
    const response = await fetch(CLICKUP_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[clickup-submit] Worker responded with an error:", response.status, text);
      return { ok: false };
    }

    const result = await response.json().catch(() => ({}));
    console.log("[clickup-submit] ClickUp submission result:", result);
    return { ok: true, result };
  } catch (err) {
    console.error("[clickup-submit] Failed to reach the ClickUp Worker:", err);
    return { ok: false, error: err };
  }
}
