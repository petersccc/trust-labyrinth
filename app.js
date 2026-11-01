/**
 * app.js
 * -------
 * The Trust Labyrinth: opening slide, 7 rooms with an insight card after
 * each, the result page (the exit) and the thank you slide. All visible
 * text comes from content.js (trust-labyrinth-content.json, word for
 * word) and privacy-content.js (the privacy notices). Nothing is stored
 * or sent anywhere until the visitor submits the form on the result page.
 */

const LANGS = ["de", "en", "zh"];
const LANG_LABELS = { de: "DE", en: "EN", zh: "中文" };

const ROOM_KEYS = {
  1: "room_1_distant_decisions",
  2: "room_2_the_control_room",
  3: "room_3_the_two_circles",
  4: "room_4_the_changing_plan",
  5: "room_5_the_call_after_hours",
  6: "room_6_the_room_of_silence",
  7: "room_7_the_first_day",
};

// Spec section 5. Card 4 is the positive card in every room.
const ORDER_DEFAULT = [1, 2, 3, 4, 5, 6, 7];
const ORDER_INFO_FIRST = [1, 4, 5, 2, 3, 6, 7];
const POSITIVE_CARD = 4;

// Result summary paths (fixed room numbers, not the visitor's order).
const TRUST_PATH = [2, 3];
const INFO_PATH = [4, 5];

const RESULT = "slide_9_result_page";

const BOOKING_URL = "https://calendly.com/cross-cultural-peters/new-meeting?utm_source=trust-labyrinth";
const WEBSITE_URL = "https://peters-crosscultural.de";

const PHOTO_1 = "img/photo-1.jpg";
const PHOTO_2 = "img/photo-2.jpg";

const state = {
  lang: readLangFromUrl(),
  screen: "opening", // opening | room | result | thanks
  pos: 1, // the visitor's position in the labyrinth, 1 to 7
  selections: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }, // card numbers per room
  insightOpen: false,
  privacyOpen: false,
  showError: false,
  form: { freeText: "", company: "", email: "", consent: false },
  formErrors: {},
  submitting: false,
};

const app = document.getElementById("app");

// ------------------------------------------------------------------
// Text lookups
// ------------------------------------------------------------------

function entry(section, element) {
  const list = CONTENT[section] || [];
  const found = list.find((e) => e.element === element);
  if (!found) console.warn("[content] missing", section, element);
  return found;
}

function text(section, element, lang = state.lang) {
  const e = entry(section, element);
  return e ? e[lang] : "";
}

function fixed(element) {
  return text("fixed_elements_on_every_page", element);
}

function roomText(room, element) {
  return text(ROOM_KEYS[room], element);
}

function hasRoomText(room, element) {
  return (CONTENT[ROOM_KEYS[room]] || []).some((e) => e.element === element);
}

function cardElement(n) {
  return n === POSITIVE_CARD ? "Card 4 (positive)" : "Card " + n;
}

function fill(template, n) {
  return template.replace("{n}", n);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes text and sets the given phrases in medium weight. */
function emphasize(s, phrases) {
  let html = esc(s);
  (phrases || []).forEach((p) => {
    const ep = esc(p);
    const i = html.indexOf(ep);
    if (i === -1) {
      console.warn("[content] bold phrase not found:", p);
      return;
    }
    html = html.slice(0, i) + "<strong>" + ep + "</strong>" + html.slice(i + ep.length);
  });
  return html;
}

/** Words set in medium weight: bold_words_en / _de / _zh in the content file. */
function boldWords(room, element) {
  const e = entry(ROOM_KEYS[room], element);
  return (e && e["bold_words_" + state.lang]) || [];
}

/**
 * Splits a text whose last words are the "Privacy notice" link text
 * (the privacy line and the consent line) into the text and the link.
 */
function withPrivacyLink(s) {
  const linkText = fixed("Footer link");
  const href = privacyHref();
  if (s.endsWith(linkText)) {
    const before = s.slice(0, s.length - linkText.length);
    return esc(before) + privacyLink(linkText);
  }
  return esc(s);
}

/**
 * The privacy notice opens as an overlay (data-privacy). The href is a
 * fallback for opening it in a new tab (middle click, no JavaScript).
 */
function privacyLink(linkText) {
  return '<a href="' + privacyHref() + '" data-privacy>' + esc(linkText) + "</a>";
}

function privacyHref() {
  return "privacy-notice.html?lang=" + state.lang;
}

// ------------------------------------------------------------------
// Language and URL
// ------------------------------------------------------------------

function readLangFromUrl() {
  try {
    const l = new URLSearchParams(window.location.search).get("lang");
    return LANGS.includes(l) ? l : "de";
  } catch (e) {
    return "de";
  }
}

function setLang(lang) {
  if (!LANGS.includes(lang) || lang === state.lang) return;
  state.lang = lang;
  // Spec section 10: the address bar always carries the current
  // language, next to any ref parameter, so a copied link shares it.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url.toString());
  } catch (e) {
    /* address bar update is best effort */
  }
  render({ keepScroll: true, focusLang: lang });
}

function applyDocumentLang() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : state.lang;
  document.title = text("page_meta", "Page title (browser tab and link preview)");
}

// ------------------------------------------------------------------
// Routing and results
// ------------------------------------------------------------------

/** Spec section 5: Room 1 decides which corridor comes first. */
function roomOrder() {
  const s = state.selections[1];
  const infoOnly = s.includes(1) && !s.includes(2) && !s.includes(3);
  return infoOnly ? ORDER_INFO_FIRST : ORDER_DEFAULT;
}

function currentRoom() {
  return roomOrder()[state.pos - 1];
}

function problemCount(room) {
  return state.selections[room].filter((n) => n !== POSITIVE_CARD).length;
}

/** Every room with at least one problem card, in fixed numbering 1 to 7. */
function stuckRooms() {
  return [1, 2, 3, 4, 5, 6, 7].filter((room) => problemCount(room) > 0);
}

/**
 * Spec section 7: the room with the most selected problem cards; a tie
 * goes to the earlier room in the fixed numbering 1 to 7. Null when no
 * problem card was selected anywhere.
 */
function stuckRoom() {
  let best = null;
  let bestCount = 0;
  for (let room = 1; room <= 7; room++) {
    const c = problemCount(room);
    if (c > bestCount) {
      best = room;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Shown only when 2 or more rooms are stuck: the count line plus one
 * summary sentence chosen from which paths the stuck rooms lie on.
 * Returns "" otherwise.
 */
function stuckSummary() {
  const stuck = stuckRooms();
  if (stuck.length < 2) return "";
  const onTrust = stuck.some((r) => TRUST_PATH.includes(r));
  const onInfo = stuck.some((r) => INFO_PATH.includes(r));
  const key = onTrust && onInfo ? "Summary A (trust path and information path)"
    : onTrust ? "Summary B (trust path only)"
    : onInfo ? "Summary C (information path only)"
    : "Summary D (only rooms 1, 6, 7)";
  const count = fill(text(RESULT, "Stuck count (2 or more stuck rooms)"), stuck.length);
  // Chinese sentences run on without a space, like the rest of the copy.
  return count + (state.lang === "zh" ? "" : " ") + text(RESULT, key);
}

/** Positive card texts, in the order the visitor walked through. */
function strengths() {
  return roomOrder()
    .filter((room) => state.selections[room].includes(POSITIVE_CARD))
    .map((room) => roomText(room, cardElement(POSITIVE_CARD)));
}

// ------------------------------------------------------------------
// Shared pieces
// ------------------------------------------------------------------

function langSwitch() {
  return (
    '<nav class="lang-switch" aria-label="Language">' +
    LANGS.map(
      (l) =>
        '<button type="button" data-lang="' + l + '" lang="' + (l === "zh" ? "zh-CN" : l) + '"' +
        (l === state.lang ? ' aria-current="true"' : "") + ">" + LANG_LABELS[l] + "</button>"
    ).join("") +
    "</nav>"
  );
}

function footer() {
  return (
    '<footer class="footer">' + esc(fixed("Footer")) +
    privacyLink(fixed("Footer link")) + "</footer>"
  );
}

/**
 * The winding labyrinth map: 7 nodes (by the visitor's position, not
 * the room number) and the exit. mode "room": passed and current nodes
 * filled feldgrau on a solid line, the rest hollow on a dashed path.
 * mode "result": the full path drawn once, stuck rooms ringed in jasper.
 */
const MAP_POINTS = [[8, 12], [50, 12], [92, 12], [92, 29], [66, 29], [40, 29], [40, 46], [80, 46], [125, 46], [160, 46]];
const MAP_NODE_INDEX = [0, 1, 2, 4, 5, 7, 8];
const C_FELDGRAU = "#536969";
const C_JASPER = "#C16952";
const C_LINE = "#DADADA";

function pathThrough(lastIndex) {
  return MAP_POINTS.slice(0, lastIndex + 1)
    .map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1])
    .join(" ");
}

function map(mode) {
  const full = pathThrough(MAP_POINTS.length - 1);
  const exitLabel = esc(fixed("Map exit"));
  let svg = '<svg class="map" viewBox="-4 0 228 58" aria-hidden="true" focusable="false">';
  svg += '<path d="' + full + '" fill="none" stroke="' + C_LINE + '" stroke-width="2" stroke-dasharray="3 3"/>';

  if (mode === "result") {
    svg += '<path class="draw" pathLength="1" d="' + full + '" fill="none" stroke="' + C_FELDGRAU + '" stroke-width="2.6" stroke-linejoin="round"/>';
    const order = roomOrder();
    MAP_NODE_INDEX.forEach((idx, i) => {
      const [x, y] = MAP_POINTS[idx];
      if (problemCount(order[i]) > 0) {
        svg += '<circle cx="' + x + '" cy="' + y + '" r="7.5" fill="#fff" stroke="' + C_JASPER + '" stroke-width="3"/>' +
          '<circle cx="' + x + '" cy="' + y + '" r="2.8" fill="' + C_JASPER + '"/>';
      } else {
        svg += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="' + C_FELDGRAU + '"/>';
      }
    });
  } else {
    const current = state.pos; // 1..7
    const currentIdx = MAP_NODE_INDEX[current - 1];
    // Solid line through every passed room up to the current one, plus
    // a short lead toward the next room.
    const [cx, cy] = MAP_POINTS[currentIdx];
    const [nx, ny] = MAP_POINTS[currentIdx + 1];
    const lead = " L" + (cx + (nx - cx) * 0.65) + " " + (cy + (ny - cy) * 0.65);
    svg += '<path d="' + pathThrough(currentIdx) + lead + '" fill="none" stroke="' + C_FELDGRAU + '" stroke-width="2.6" stroke-linejoin="round"/>';
    MAP_NODE_INDEX.forEach((idx, i) => {
      const [x, y] = MAP_POINTS[idx];
      const position = i + 1;
      if (position < current) {
        svg += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + C_FELDGRAU + '"/>';
      } else if (position === current) {
        svg += '<circle cx="' + x + '" cy="' + y + '" r="6.5" fill="' + C_FELDGRAU + '"/>';
      } else {
        svg += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#fff" stroke="#BDBDBD" stroke-width="1.5"/>';
      }
    });
  }
  svg += '<text class="map-exit" x="170" y="49.5">' + exitLabel + "</text></svg>";
  return svg;
}

/** A text link button in the website style: words, then a jasper arrow. */
function entryButton(label, attrs) {
  return '<button class="entry" ' + attrs + '><span>' + esc(label) + '</span><i aria-hidden="true">→</i></button>';
}

function cardTop(label) {
  return '<div class="pc-top"><span>' + esc(label) + "</span></div>";
}

// ------------------------------------------------------------------
// Screens
// ------------------------------------------------------------------

function renderOpening() {
  const s = "slide_1_opening";
  return (
    '<main class="page opening">' + langSwitch() +
    '<section class="pc">' +
    cardTop(text(s, "Caption under photo")) +
    '<div class="who"><img class="ring" src="' + PHOTO_1 + '" alt="Katarina Peters">' +
    '<h1 class="display">' + esc(text(s, "Title")) + "</h1></div>" +
    '<p class="based-on">' + esc(text(s, "Based on line (italic)")) + "</p>" +
    entryButton(text(s, "Button"), 'type="button" data-action="enter"') +
    "</section>" +
    footer() + "</main>"
  );
}

function renderRoom() {
  const room = currentRoom();
  const sel = state.selections[room];
  let html =
    '<main class="page room">' + langSwitch() + map("room") +
    '<section class="pc">' +
    cardTop(fill(fixed("Header band label"), state.pos)) +
    '<h1 class="h">' + esc(roomText(room, "Room name")) + "</h1>" +
    '<p class="intro">' + esc(roomText(room, "Intro")) + "</p>" +
    '<p class="key">' + esc(roomText(room, "Key line")) + "</p>";
  if (hasRoomText(room, "Small note")) {
    html += '<p class="note">' + esc(roomText(room, "Small note")) + "</p>";
  }
  html +=
    '<h2 class="question" id="q">' + esc(fixed("Question")) + "</h2>" +
    '<p class="lbl question-sub">' + esc(fixed("Under the question")) + "</p>" +
    '<div class="opts" role="group" aria-labelledby="q">';
  for (let n = 1; n <= 4; n++) {
    html +=
      '<button type="button" class="opt" data-card="' + n + '" aria-pressed="' + sel.includes(n) + '">' +
      esc(roomText(room, cardElement(n))) + '<i class="tick" aria-hidden="true"></i></button>';
  }
  html += "</div>";
  html += '<p class="error" role="alert" id="room-error"' + (state.showError ? "" : " hidden") + ">" +
    esc(fixed("Error message")) + "</p>";
  html +=
    '<div class="room-nav">' +
    '<button type="button" class="link-muted" data-action="back">' + esc(fixed("Back button")) + "</button>" +
    entryButton(fixed("Next button"), 'type="button" data-action="next"') +
    "</div>";
  if (hasRoomText(room, "Privacy line")) {
    html += '<p class="privacy-line">' + withPrivacyLink(roomText(room, "Privacy line")) + "</p>";
  }
  html += "</section>" + footer() + "</main>";
  if (state.insightOpen) html += renderInsight(room);
  return html;
}

/** An insight block: tone "j" = jasper bar, "g" = feldgrau bar. */
function insightBlock(room, labelEl, textEl, tone) {
  return (
    '<div class="sc ' + tone + '">' +
    '<span class="lbl">' + esc(roomText(room, labelEl)) + "</span>" +
    "<p>" + emphasize(roomText(room, textEl), boldWords(room, textEl)) + "</p></div>"
  );
}

/**
 * Spec section 6: the button names the next room. The verb part comes
 * from the room at the visitor's current position (positions 1 to 5),
 * the room name from the next room in their order. After position 6
 * and 7 the button text is fixed.
 */
function insightButtonText() {
  const pos = state.pos;
  const verbRoom = pos; // by position, not room number
  const button = roomText(verbRoom, "Button");
  if (pos >= 6) return button;
  const nextName = roomText(roomOrder()[pos], "Room name");
  // The verb part ends with a colon in every language; Chinese takes no
  // space and has no capitals.
  if (state.lang === "zh") return button + nextName;
  return button + " " + nextName.toUpperCase();
}

function renderInsight(room) {
  let body = "";
  if (room === 3) {
    body += insightBlock(room, "Insight: label", "Insight: text", "j");
  } else {
    // Rooms 1, 2, 4, 5, 6: the two sides; Room 7: STEP 1 and STEP 2.
    body += insightBlock(room, "Insight: label 1", "Insight: text 1", "j");
    body += insightBlock(room, "Insight: label 2", "Insight: text 2", "g");
    if (hasRoomText(room, "Insight: bridge")) {
      body += '<p class="bridge">' + esc(roomText(room, "Insight: bridge")) + "</p>";
    }
  }
  body += '<p class="key">' + esc(roomText(room, "Insight: key line")) + "</p>";
  body += '<div class="insight-next">' + entryButton(insightButtonText(), 'type="button" data-action="continue"');
  // Countdown by position: the content file's countdown for positions 1
  // to 6 ("6 rooms to go" ... "Last room"), nothing after the 7th.
  if (state.pos <= 6) {
    body += '<p class="lbl countdown">' + esc(roomText(state.pos, "Countdown")) + "</p>";
  }
  body += "</div>";
  return (
    '<div class="overlay" data-overlay>' +
    '<section class="pc insight" role="dialog" aria-modal="true" aria-labelledby="insight-title" tabindex="-1">' +
    cardTop(roomText(room, "Room name")) +
    '<div class="head"><img src="' + PHOTO_1 + '" alt="">' +
    '<h2 id="insight-title">' + esc(fixed("Insight card header")) + "</h2></div>" +
    body + "</section></div>"
  );
}

/** "Room name: sentence" result lines, split into the name and sentence. */
function splitResultLine(line) {
  const m = line.match(/^(.+?)(?:：|:\s)(.+)$/);
  return m ? { name: m[1], sentence: m[2] } : { name: "", sentence: line };
}

function renderResult() {
  const s = "slide_9_result_page";
  const strong = strengths();
  const stuck = stuckRoom();
  const f = state.form;
  const err = state.formErrors;

  let html =
    '<main class="page result">' + langSwitch() +
    '<section class="pc">' +
    cardTop(text(s, "Header label")) +
    '<h1 class="h">' + esc(text(s, "Header title")) + "</h1>" +
    map("result") +
    '<div class="legend"><span><i class="passed"></i>' + esc(text(s, "Map legend 1")) + "</span>" +
    '<span><i class="stuck"></i>' + esc(text(s, "Map legend 2")) + "</span></div>";

  html += '<div class="sc g"><span class="lbl">' + esc(text(s, "Strengths label")) + "</span>";
  if (strong.length) {
    strong.forEach((t) => (html += '<p class="ln">' + esc(t) + "</p>"));
  } else {
    html += "<p>" + esc(text(s, "If no positive cards")) + "</p>";
  }
  html += "</div>";

  if (stuck) {
    const line = splitResultLine(text(s, "Result: Room " + stuck));
    const summary = stuckSummary();
    // One stuck room: "WHERE YOU GOT STUCK". Two or more: "...MOST" plus
    // the count line and summary sentence, without naming the others.
    const label = summary ? text(s, "Stuck label (main, 2 or more stuck rooms)") : text(s, "Stuck label");
    html +=
      '<div class="sc j"><span class="lbl">' + esc(label) + "</span>" +
      '<p class="stuck-room">' + esc(line.name) + "</p>" +
      '<p class="stuck-text">' + esc(line.sentence) + "</p>" +
      (summary ? '<p class="stuck-summary">' + esc(summary) + "</p>" : "") +
      "</div>";
  } else {
    html += '<div class="sc j"><p>' + esc(text(s, "Only positive cards")) + "</p></div>";
  }
  html += "</section>";

  html +=
    '<form class="pc cta" novalidate data-form>' +
    "<h2>" + esc(text(s, "CTA heading")) + "</h2>" +
    '<p class="cta-text">' + esc(text(s, "CTA text")) + "</p>" +
    '<textarea class="field" name="freeText" maxlength="2000" aria-label="' + esc(text(s, "Optional field")) +
    '" placeholder="' + esc(text(s, "Optional field")) + '">' + esc(f.freeText) + "</textarea>" +
    '<input class="field" name="company" type="text" autocomplete="organization" maxlength="200" aria-label="' +
    esc(text(s, "Placeholder 1")) + '" placeholder="' + esc(text(s, "Placeholder 1")) + '" value="' + esc(f.company) + '"' +
    (err.company ? ' aria-invalid="true" aria-describedby="err-company"' : "") + ">" +
    (err.company ? '<p class="error field-error" id="err-company">' + esc(text(s, "Error 3 (company name)")) + "</p>" : "") +
    '<input class="field" name="email" type="email" autocomplete="email" maxlength="200" aria-label="' +
    esc(text(s, "Placeholder 2")) + '" placeholder="' + esc(text(s, "Placeholder 2")) + '" value="' + esc(f.email) + '"' +
    (err.email ? ' aria-invalid="true" aria-describedby="err-email"' : "") + ">" +
    (err.email ? '<p class="error field-error" id="err-email">' + esc(text(s, "Error 1")) + "</p>" : "") +
    '<label class="consent"><input type="checkbox" name="consent"' + (f.consent ? " checked" : "") +
    (err.consent ? ' aria-invalid="true" aria-describedby="err-consent"' : "") + ">" +
    "<span>" + withPrivacyLink(text(s, "Consent")) + "</span></label>" +
    (err.consent ? '<p class="error field-error" id="err-consent">' + esc(text(s, "Error 2")) + "</p>" : "") +
    entryButton(text(s, "Button"), 'type="submit"' + (state.submitting ? " disabled" : "")) +
    "</form>";

  html += footer() + "</main>";
  return html;
}

function renderThanks() {
  const s = "slide_10_thank_you";
  return (
    '<main class="page thanks">' + langSwitch() +
    '<section class="pc">' +
    '<img class="ring thanks-photo" src="' + PHOTO_2 + '" alt="Katarina Peters">' +
    '<p class="caption">' + esc(text(s, "Caption under photo")) + "</p>" +
    '<p class="lbl thanks-label">' + esc(text(s, "Small label")) + "</p>" +
    '<h1 class="display thanks-title">' + esc(text(s, "Title")) + "</h1>" +
    '<div class="confirm" role="status">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#536969" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>' +
    "<span>" + esc(text(s, "Confirmation")) + "</span></div>" +
    '<div class="sc j booking"><h2>' + esc(text(s, "Booking question")) + "</h2>" +
    "<p>" + esc(text(s, "Booking text")) + "</p>" +
    '<a class="entry" href="' + BOOKING_URL + '" target="_blank" rel="noopener"><span>' + esc(text(s, "Button")) +
    '</span><i aria-hidden="true">→</i></a></div>' +
    '<a class="site" href="' + WEBSITE_URL + '" target="_blank" rel="noopener">' + esc(text(s, "Website")) + "</a>" +
    "</section>" +
    footer() + "</main>"
  );
}

// ------------------------------------------------------------------
// Render + events
// ------------------------------------------------------------------

function render(opts = {}) {
  applyDocumentLang();
  const scrollY = window.scrollY;
  const screens = { opening: renderOpening, room: renderRoom, result: renderResult, thanks: renderThanks };
  app.innerHTML = screens[state.screen]();
  document.body.style.overflow = state.insightOpen ? "hidden" : "";

  if (opts.keepScroll) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);

  if (opts.focusLang) {
    const b = app.querySelector('[data-lang="' + opts.focusLang + '"]');
    if (b) b.focus();
  } else if (state.insightOpen) {
    const b = app.querySelector(".insight");
    if (b) b.focus({ preventScroll: true });
  } else if (opts.focusSelector) {
    const el = app.querySelector(opts.focusSelector);
    if (el) el.focus();
  } else if (opts.focusHeading) {
    const h = app.querySelector("h1");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  }
}

function go(screen, pos) {
  state.screen = screen;
  if (pos) state.pos = pos;
  state.insightOpen = false;
  state.showError = false;
  render({ focusHeading: true });
}

app.addEventListener("click", (e) => {
  const langBtn = e.target.closest("[data-lang]");
  if (langBtn) return setLang(langBtn.dataset.lang);

  const card = e.target.closest("[data-card]");
  if (card) {
    const room = currentRoom();
    const n = Number(card.dataset.card);
    const sel = state.selections[room];
    state.selections[room] = sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n].sort();
    // Update in place so focus and scroll stay put.
    card.setAttribute("aria-pressed", String(state.selections[room].includes(n)));
    if (state.selections[room].length) {
      state.showError = false;
      const err = app.querySelector("#room-error");
      if (err) err.hidden = true;
    }
    return;
  }

  // Clicking the dimmed room behind the insight card closes it again.
  if (e.target.matches("[data-overlay]")) {
    state.insightOpen = false;
    return render({ keepScroll: true, focusSelector: '[data-action="next"]' });
  }

  const action = e.target.closest("[data-action]");
  if (!action) return;
  switch (action.dataset.action) {
    case "enter":
      return go("room", 1);
    case "back":
      return state.pos === 1 ? go("opening") : go("room", state.pos - 1);
    case "next":
      if (!state.selections[currentRoom()].length) {
        state.showError = true;
        const err = app.querySelector("#room-error");
        if (err) err.hidden = false;
        return;
      }
      state.insightOpen = true;
      return render({ keepScroll: true });
    case "continue":
      return state.pos < 7 ? go("room", state.pos + 1) : go("result");
  }
});

// ------------------------------------------------------------------
// Privacy notice overlay
// ------------------------------------------------------------------
// Opens on top of whatever the visitor is looking at. The page below is
// not re-rendered, so selections, an open insight card, typed form
// values and the scroll position are exactly as they were on close.

let privacyReturnFocus = null;

function openPrivacy() {
  if (state.privacyOpen) return;
  state.privacyOpen = true;
  privacyReturnFocus = document.activeElement;
  const back = esc(fixed("Privacy back button"));
  const el = document.createElement("div");
  el.className = "overlay privacy-overlay";
  el.id = "privacy";
  el.setAttribute("data-privacy-overlay", "");
  el.innerHTML =
    '<section class="pc privacy-panel" role="dialog" aria-modal="true" aria-labelledby="privacy-title" tabindex="-1" lang="' +
    (state.lang === "zh" ? "zh-CN" : state.lang) + '">' +
    '<button type="button" class="link-back" data-close-privacy><i aria-hidden="true">←</i> ' + back + "</button>" +
    '<div class="privacy-body">' + PRIVACY_HTML[state.lang].replace("<h1>", '<h1 id="privacy-title">') + "</div>" +
    '<button type="button" class="entry privacy-close" data-close-privacy><span>' + back + '</span></button>' +
    "</section>";
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  el.querySelector(".privacy-panel").focus({ preventScroll: true });
}

function closePrivacy() {
  const el = document.getElementById("privacy");
  if (el) el.remove();
  state.privacyOpen = false;
  document.body.style.overflow = state.insightOpen ? "hidden" : "";
  if (privacyReturnFocus && document.contains(privacyReturnFocus)) privacyReturnFocus.focus();
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-privacy]");
  if (link) {
    // Ctrl/Cmd/middle click still opens the standalone page in a new tab.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    // preventDefault also keeps the link inside the consent label from
    // ticking the checkbox.
    e.preventDefault();
    e.stopPropagation();
    return openPrivacy();
  }
  if (e.target.closest("[data-close-privacy]") || e.target.matches("[data-privacy-overlay]")) {
    closePrivacy();
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.privacyOpen) {
    closePrivacy();
    return;
  }
  if (e.key === "Escape" && state.insightOpen) {
    state.insightOpen = false;
    render({ keepScroll: true, focusSelector: '[data-action="next"]' });
  }
});

// Keep the form values in state, so a language switch keeps them.
app.addEventListener("input", (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  const name = e.target.name;
  if (name === "consent") state.form.consent = e.target.checked;
  else if (name in state.form) state.form[name] = e.target.value;
});
app.addEventListener("change", (e) => {
  if (e.target.name === "consent") state.form.consent = e.target.checked;
});

app.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.submitting) return;
  const f = state.form;
  const errors = {};
  if (!f.company.trim()) errors.company = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) errors.email = true;
  if (!f.consent) errors.consent = true;
  state.formErrors = errors;

  if (Object.keys(errors).length) {
    const first = errors.company ? "company" : errors.email ? "email" : "consent";
    return render({ keepScroll: true, focusSelector: '[name="' + first + '"]' });
  }

  state.submitting = true;
  render({ keepScroll: true });
  await submitToWorker(buildSubmission());
  state.submitting = false;
  go("thanks");
});

/** Everything Katarina sees in the ClickUp task, in the visitor's language. */
function buildSubmission() {
  const order = roomOrder();
  const stuck = stuckRoom();
  return {
    email: state.form.email.trim(),
    companyName: state.form.company.trim(),
    lang: state.lang,
    order,
    rooms: order.map((room, i) => ({
      position: i + 1,
      number: room,
      name: roomText(room, "Room name"),
      selected: state.selections[room].map((n) => ({
        card: n,
        positive: n === POSITIVE_CARD,
        text: roomText(room, cardElement(n)),
      })),
    })),
    stuckRoom: stuck ? roomText(stuck, "Room name") : "",
    stuckRooms: stuckRooms().map((room) => ({
      number: room,
      name: roomText(room, "Room name"),
      problemCards: problemCount(room),
      main: room === stuck,
    })),
    summary: stuckSummary(),
    strengths: strengths(),
    freeText: state.form.freeText.trim(),
  };
}

// Content check: every bold phrase must appear in its text, and every
// insight text with English bold words needs German and Chinese ones.
Object.values(CONTENT).forEach((list) => {
  if (!Array.isArray(list)) return;
  list.forEach((e) => {
    LANGS.forEach((l) => {
      const words = e["bold_words_" + l];
      if (e.bold_words_en && !words && /^Insight/.test(e.element)) {
        console.warn("[content] missing bold_words_" + l + ":", e.element, e.en);
      }
      (words || []).forEach((p) => {
        if (!e[l].includes(p)) console.warn("[content] bold phrase not in text:", e.element, l, p);
      });
    });
  });
});

render();
