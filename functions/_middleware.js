/**
 * functions/_middleware.js (Cloudflare Pages Function)
 * -----------------------------------------------------
 * Link previews (spec section 14). Preview crawlers do not run
 * JavaScript, so the language switch in app.js cannot change what they
 * see. This runs on Cloudflare before the page is served and puts the
 * matching title, description, preview image and locale into the HTML
 * for ?lang=en and ?lang=zh. German stays the default. It also makes the
 * preview image URL absolute, which crawlers require.
 */

const META = {
  de: {
    title: "Vertrauenslabyrinth: Wo geht in Ihrem Team Vertrauen verloren?",
    description: "Ein kurzer Check auf Basis von Mitarbeiterbewertungen aus 17 chinesischen Unternehmen in Deutschland. Finden Sie heraus, wo Ihr Team feststeckt.",
    locale: "de_DE",
    htmlLang: "de",
  },
  en: {
    title: "Trust Labyrinth: Where does your team lose trust?",
    description: "A short checkup based on employee reviews at 17 Chinese companies in Germany. Find out where your team gets stuck.",
    locale: "en_GB",
    htmlLang: "en",
  },
  zh: {
    title: "信任迷宫：您的团队在哪里失去了信任？",
    description: "基于德国17家中资企业员工评价的简短自测。看看您的团队卡在了哪里。",
    locale: "zh_CN",
    htmlLang: "zh-CN",
  },
};

export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const isPage = url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/index";
  const contentType = response.headers.get("content-type") || "";
  if (!isPage || !contentType.includes("text/html")) return response;

  const requested = url.searchParams.get("lang");
  const lang = META[requested] ? requested : "de";
  const meta = META[lang];
  const image = url.origin + "/og/og-image-" + lang + ".jpg";

  const setContent = (value) => ({
    element(el) {
      el.setAttribute("content", value);
    },
  });

  return new HTMLRewriter()
    .on("html", { element(el) { el.setAttribute("lang", meta.htmlLang); } })
    .on("title", { element(el) { el.setInnerContent(meta.title); } })
    .on('meta[name="description"]', setContent(meta.description))
    .on('meta[property="og:title"]', setContent(meta.title))
    .on('meta[property="og:description"]', setContent(meta.description))
    .on('meta[property="og:image"]', setContent(image))
    .on('meta[property="og:locale"]', setContent(meta.locale))
    .transform(response);
}
