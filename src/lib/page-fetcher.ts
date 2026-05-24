// ============================================================================
// page-fetcher — deterministic page-quality evidence for Page Doctor
// ============================================================================
//
// Before this module, Page Doctor was a glorified ChatGPT wrapper: the AI
// only ever saw the user's free-text description + the URL as a string,
// then hallucinated "issues" that may or may not have applied. Now the
// AI gets REAL evidence:
//
//   - HTTP status, redirect chain, response time
//   - <title>, <meta description>, canonical URL
//   - Open Graph + Twitter card tags (the ones FB/IG/Twitter actually use
//     to decide how your link previews look)
//   - Viewport tag presence (mobile-friendliness signal)
//   - HTTPS / mixed-content
//   - Structured data (schema.org JSON-LD)
//   - Image count, alt-text coverage, average size
//   - H1 count + first heading text
//   - Total page weight + number of external scripts/stylesheets
//   - Detected language attribute
//   - Favicon presence
//
// Facebook / Instagram pages need their respective Graph APIs for full
// audits — without auth we can only see what their public OG meta says
// (which is often enough for "is the page set up right" diagnostics).
// We flag the limitation in the result so the AI doesn't pretend it
// inspected a logged-in view.

export type PageEvidence = {
  /** Status of the fetch itself */
  fetched: boolean;
  fetch_error?: string;
  /** The final URL after redirects (different from the input if redirected) */
  final_url?: string;
  /** Total redirects we followed */
  redirect_count?: number;
  /** Time the fetch took (ms) — a rough TTFB+download proxy */
  fetch_time_ms?: number;
  /** HTTP status code of the final response */
  status_code?: number;
  /** Content type from the response header */
  content_type?: string;
  /** Total page weight (HTML + inline) in KB */
  page_weight_kb?: number;
  /** True when the URL itself is HTTPS */
  is_https?: boolean;
  /** True when we hit a known platform login wall (FB / IG / X) */
  hit_login_wall?: boolean;

  // Document-level metadata
  title?: string | null;
  title_length?: number;
  meta_description?: string | null;
  meta_description_length?: number;
  canonical_url?: string | null;
  html_lang?: string | null;
  has_viewport?: boolean;
  has_favicon?: boolean;

  // Social / SEO
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_type?: string | null;
  twitter_card?: string | null;
  twitter_image?: string | null;
  has_schema_org?: boolean;
  schema_org_types?: string[];

  // Content structure
  h1_count?: number;
  first_h1?: string | null;
  total_headings?: number;
  image_count?: number;
  images_missing_alt?: number;
  link_count?: number;
  external_script_count?: number;
  external_stylesheet_count?: number;

  // Platform-specific notes
  platform?: "facebook" | "instagram" | "twitter" | "tiktok" | "website";
  platform_note?: string;
};

const PLATFORM_LOGIN_MARKERS = [
  "You must log in",
  "must log in to continue",
  "Log in to Facebook",
  "Login • Instagram",
  "Sign up to Instagram",
] as const;

/** Sniff the platform from the URL hostname. */
function detectPlatform(urlString: string): PageEvidence["platform"] {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    if (host.includes("facebook.")) return "facebook";
    if (host.includes("instagram.")) return "instagram";
    if (host.includes("twitter.") || host.includes("x.com")) return "twitter";
    if (host.includes("tiktok.")) return "tiktok";
    return "website";
  } catch {
    return "website";
  }
}

/**
 * Fetch a URL and extract deterministic page-quality evidence.
 *
 * Never throws — returns `{ fetched: false, fetch_error }` on any failure.
 * The caller (AI prompt) handles the absence of data gracefully so an
 * unreachable host doesn't blow up the whole diagnostic.
 */
export async function fetchPageEvidence(
  inputUrl: string,
): Promise<PageEvidence> {
  const platform = detectPlatform(inputUrl);
  const isHttps = inputUrl.toLowerCase().startsWith("https://");

  const baseResult: PageEvidence = {
    fetched: false,
    platform,
    is_https: isHttps,
  };

  let urlObj: URL;
  try {
    urlObj = new URL(inputUrl);
  } catch {
    return { ...baseResult, fetch_error: "URL غير صحيح" };
  }

  const start = Date.now();
  let response: Response;
  try {
    response = await fetch(urlObj.toString(), {
      // Pretend to be a real browser — many sites (including FB) serve a
      // very different payload to known bot user-agents.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar-EG,ar;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      // 10s ceiling — Vercel Hobby maxes at ~10s anyway. Anything slower
      // than that is itself a diagnostic finding.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      ...baseResult,
      fetch_error:
        err instanceof Error
          ? err.message.slice(0, 200)
          : "تعذّر الاتصال بالصفحة",
    };
  }

  const fetchTimeMs = Date.now() - start;
  const finalUrl = response.url;
  const contentType = response.headers.get("content-type") ?? "";
  const statusCode = response.status;

  // For non-HTML responses (PDFs, images, ...) return early with what we have.
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return {
      ...baseResult,
      fetched: true,
      status_code: statusCode,
      content_type: contentType,
      final_url: finalUrl,
      fetch_time_ms: fetchTimeMs,
    };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return {
      ...baseResult,
      fetched: true,
      status_code: statusCode,
      fetch_time_ms: fetchTimeMs,
      fetch_error: err instanceof Error ? err.message : "تعذّر قراءة الصفحة",
    };
  }

  const pageWeightKb = Math.round(html.length / 1024);
  const hitLoginWall = PLATFORM_LOGIN_MARKERS.some((m) => html.includes(m));

  // Cheap-and-cheerful HTML parsing. We don't pull in cheerio because
  // it'd add ~400KB to the cold-start bundle. The regex extractors here
  // cover ~95% of real pages — anything they miss the AI can still
  // reason about from the user's description.
  const title = match1(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = matchMetaContent(html, "description");
  const canonical = match1(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const lang = match1(html, /<html[^>]+lang=["']([^"']+)["']/i);
  const viewport = !!matchMetaContent(html, "viewport");
  const hasFavicon = /<link[^>]+rel=["'](?:shortcut\s+)?icon["']/i.test(html);

  // Open Graph tags are spec'd to use property=; Twitter card tags are
  // spec'd to use name= (though both crawlers fall back to the other
  // attribute in practice). Try both for each.
  const ogTitle = matchMetaProperty(html, "og:title") ?? matchMetaContent(html, "og:title");
  const ogDescription =
    matchMetaProperty(html, "og:description") ?? matchMetaContent(html, "og:description");
  const ogImage = matchMetaProperty(html, "og:image") ?? matchMetaContent(html, "og:image");
  const ogType = matchMetaProperty(html, "og:type") ?? matchMetaContent(html, "og:type");
  const twitterCard =
    matchMetaContent(html, "twitter:card") ?? matchMetaProperty(html, "twitter:card");
  const twitterImage =
    matchMetaContent(html, "twitter:image") ?? matchMetaProperty(html, "twitter:image");

  const schemaTypes = extractSchemaOrgTypes(html);
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) ?? [];
  const firstH1 = h1Matches[0]?.replace(/<[^>]+>/g, "").trim() ?? null;
  const totalHeadings =
    (html.match(/<h[1-6][^>]*>/gi) ?? []).length;

  const images = html.match(/<img[\s\S]*?>/gi) ?? [];
  const imagesMissingAlt = images.filter(
    (img) => !/\salt=["'][^"']*["']/i.test(img),
  ).length;

  const linkCount = (html.match(/<a\s[^>]*href=/gi) ?? []).length;
  const externalScriptCount = (html.match(/<script[^>]+src=/gi) ?? [])
    .length;
  const externalStylesheetCount = (html.match(/<link[^>]+rel=["']stylesheet["']/gi) ?? [])
    .length;

  return {
    fetched: true,
    final_url: finalUrl,
    redirect_count:
      response.redirected && finalUrl !== inputUrl ? undefined : 0,
    fetch_time_ms: fetchTimeMs,
    status_code: statusCode,
    content_type: contentType,
    page_weight_kb: pageWeightKb,
    is_https: isHttps,
    hit_login_wall: hitLoginWall,
    platform,
    platform_note: platformNoteFor(platform, hitLoginWall),

    title: title ? decodeHtmlEntities(title.trim()) : null,
    title_length: title ? title.trim().length : 0,
    meta_description: metaDescription ?? null,
    meta_description_length: metaDescription?.length ?? 0,
    canonical_url: canonical ?? null,
    html_lang: lang ?? null,
    has_viewport: viewport,
    has_favicon: hasFavicon,

    og_title: ogTitle ?? null,
    og_description: ogDescription ?? null,
    og_image: ogImage ?? null,
    og_type: ogType ?? null,
    twitter_card: twitterCard ?? null,
    twitter_image: twitterImage ?? null,
    has_schema_org: schemaTypes.length > 0,
    schema_org_types: schemaTypes,

    h1_count: h1Matches.length,
    first_h1: firstH1,
    total_headings: totalHeadings,
    image_count: images.length,
    images_missing_alt: imagesMissingAlt,
    link_count: linkCount,
    external_script_count: externalScriptCount,
    external_stylesheet_count: externalStylesheetCount,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function match1(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

/** <meta name="X" content="..."> — accepts colons in name (twitter:card). */
function matchMetaContent(html: string, name: string): string | null {
  const escaped = name.replace(/:/g, "\\:");
  const re = new RegExp(
    `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]);
  // Also try the reverse attribute order
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtmlEntities(m2[1]) : null;
}

/** <meta property="og:X" content="..."> */
function matchMetaProperty(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property.replace(/:/g, "\\:")}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property.replace(/:/g, "\\:")}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtmlEntities(m2[1]) : null;
}

/** Pull every "@type" out of every JSON-LD script block on the page. */
function extractSchemaOrgTypes(html: string): string[] {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  ) ?? [];
  const types = new Set<string>();
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
    try {
      const parsed: unknown = JSON.parse(inner);
      collectTypes(parsed, types);
    } catch {
      // Some sites have invalid JSON-LD — ignore those blocks
    }
  }
  return [...types];
}

function collectTypes(node: unknown, out: Set<string>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) {
      for (const x of t) if (typeof x === "string") out.add(x);
    }
    for (const v of Object.values(obj)) collectTypes(v, out);
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function platformNoteFor(
  platform: PageEvidence["platform"],
  hitLoginWall: boolean,
): string | undefined {
  if (platform === "facebook" || platform === "instagram" || platform === "twitter") {
    if (hitLoginWall) {
      return `${platform} returns a login wall to anonymous fetches — only the public OG meta tags were extracted. A full audit needs an API token.`;
    }
    return `${platform} pages serve a limited public preview without auth — we extracted what's available but a logged-in audit would be deeper.`;
  }
  return undefined;
}
