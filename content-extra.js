// content-extra.js
// Text that is not in trust-labyrinth-content.json but was given by
// Katarina elsewhere: templates from the build spec (sections 6 and 14)
// and her answers to the pre-build questions (company name error, map
// exit label). Nothing in here is invented copy.

const EXTRA = {
  // Spec section 6: header band label, by the visitor's position 1 to 7.
  roomLabel: {
    en: "ROOM {n} OF 7",
    de: "RAUM {n} VON 7",
    zh: "第{n}个房间（共7个）",
  },

  // Katarina, pre-build answers: company name is required.
  companyError: {
    en: "Enter your company name.",
    de: "Bitte geben Sie Ihren Firmennamen ein.",
    zh: "请输入公司名称。",
  },

  // Katarina, pre-build answers: the word at the end of the map.
  mapExit: {
    en: "Exit",
    de: "Ausgang",
    zh: "出口",
  },

  // Spec section 14: page title (also the link preview title).
  pageTitle: {
    de: "Vertrauenslabyrinth: Wo geht in Ihrem Team Vertrauen verloren?",
    en: "Trust Labyrinth: Where does your team lose trust?",
    zh: "信任迷宫：您的团队在哪里失去了信任？",
  },
  pageDescription: {
    de: "Ein kurzer Check auf Basis von Mitarbeiterbewertungen aus 17 chinesischen Unternehmen in Deutschland. Finden Sie heraus, wo Ihr Team feststeckt.",
    en: "A short checkup based on employee reviews at 17 Chinese companies in Germany. Find out where your team gets stuck.",
    zh: "基于德国17家中资企业员工评价的简短自测。看看您的团队卡在了哪里。",
  },
};

// Spec section 8: "Words listed in bold_words_en are medium weight. In
// German and Chinese, set the equivalent words in medium weight."
// Keyed by room number and element. Each phrase appears verbatim in the
// matching text of the content file (checked at startup in app.js, which
// logs a warning if one ever stops matching).
const BOLD_WORDS = {
  1: {
    "Insight: text 1": { de: ["Ausgangspunkt"], zh: ["起点"] },
    "Insight: text 2": { de: ["endgültig"], zh: ["定案"] },
  },
  2: {
    "Insight: text 1": { de: ["persönliche Beziehung"], zh: ["个人关系"] },
    "Insight: text 2": { de: ["Zweifel an ihrer Kompetenz"], zh: ["对自身能力的怀疑"] },
  },
  3: {
    "Insight: text": { de: ["gemeinsame Sprache", "geschlossenen Kreis"], zh: ["共同的语言", "封闭的圈子"] },
  },
  4: {
    "Insight: text 1": { de: ["noch in Arbeit"], zh: ["仍在制定中"] },
    "Insight: text 2": { de: ["planen sorgfältig und weit im Voraus"], zh: ["周密地提前很久做计划"] },
  },
  5: {
    "Insight: text 1": { de: ["sechs bis sieben Stunden voraus", "Zeichen von Engagement"], zh: ["快六到七个小时", "投入的表现"] },
    "Insight: text 2": { de: ["klare Arbeitszeiten"], zh: ["明确的工作时间"] },
  },
  6: {
    "Insight: text 1": { de: ["Gesichtsverlust"], zh: ["丢面子"] },
    "Insight: text 2": { de: ["wird still oder geht"], zh: ["要么沉默，要么离开"] },
  },
  7: {
    "Insight: text 1": { de: ["von den Menschen, die schon da sind"], zh: ["从已经在公司里的人身上"] },
    "Insight: text 2": { de: ["ist genau diese Reibung das Erste, was sie lernen"], zh: ["这种摩擦就是他们最先学到的东西"] },
  },
};
