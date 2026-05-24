// ============================================================================
// Unit tests for page-fetcher's HTML extraction helpers
// ============================================================================
//
// We test the extractors against synthetic HTML fixtures (not real
// network calls) — those go in an integration / e2e suite later. The
// goal here is to prove the parsing handles attribute-order variation,
// missing tags, broken JSON-LD, multiple H1s, etc.

import { describe, it, expect } from "vitest";

// We can't import the private helpers — instead we drive them through
// a fake fetch() that returns our fixture HTML.
import { fetchPageEvidence } from "./page-fetcher";

function mockFetchOnce(html: string, opts: { status?: number; contentType?: string } = {}) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(html, {
      status: opts.status ?? 200,
      headers: {
        "content-type": opts.contentType ?? "text/html; charset=utf-8",
      },
    });
  return () => {
    globalThis.fetch = realFetch;
  };
}

describe("fetchPageEvidence — happy path", () => {
  it("extracts title + meta description + canonical + lang", async () => {
    const restore = mockFetchOnce(`
      <!DOCTYPE html>
      <html lang="ar-EG">
        <head>
          <title>أبواب WPC مصرية | المصرية الألمانية</title>
          <meta name="description" content="أبواب WPC ضد الماء والحشرات، تقاوم 20 سنة.">
          <link rel="canonical" href="https://egerman.example/products/wpc">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="icon" href="/favicon.ico">
        </head>
        <body><h1>أبواب WPC</h1></body>
      </html>
    `);
    try {
      const r = await fetchPageEvidence("https://egerman.example/products/wpc");
      expect(r.fetched).toBe(true);
      expect(r.title).toBe("أبواب WPC مصرية | المصرية الألمانية");
      expect(r.meta_description).toMatch(/WPC ضد الماء/);
      expect(r.canonical_url).toBe("https://egerman.example/products/wpc");
      expect(r.html_lang).toBe("ar-EG");
      expect(r.has_viewport).toBe(true);
      expect(r.has_favicon).toBe(true);
      expect(r.h1_count).toBe(1);
      expect(r.first_h1).toBe("أبواب WPC");
    } finally {
      restore();
    }
  });

  it("extracts Open Graph + Twitter card tags in either attribute order", async () => {
    const restore = mockFetchOnce(`
      <html><head>
        <meta property="og:title" content="OG Title">
        <meta content="OG Description Here" property="og:description">
        <meta property="og:image" content="https://example.com/img.jpg">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="https://example.com/tw.jpg">
      </head><body></body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.og_title).toBe("OG Title");
      expect(r.og_description).toBe("OG Description Here");
      expect(r.og_image).toBe("https://example.com/img.jpg");
      expect(r.og_type).toBe("website");
      expect(r.twitter_card).toBe("summary_large_image");
      expect(r.twitter_image).toBe("https://example.com/tw.jpg");
    } finally {
      restore();
    }
  });

  it("counts H1s + images + missing alt attributes", async () => {
    const restore = mockFetchOnce(`
      <html><body>
        <h1>First</h1>
        <h1>Second</h1>
        <h2>Sub</h2>
        <h3>Sub2</h3>
        <img src="/a.jpg" alt="An image">
        <img src="/b.jpg">
        <img src="/c.jpg" alt="">
        <img src="/d.jpg" alt="ok">
      </body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.h1_count).toBe(2);
      expect(r.total_headings).toBe(4);
      expect(r.image_count).toBe(4);
      // alt="" is technically present (decorative image), so it
      // counts as "has alt" by our regex.
      expect(r.images_missing_alt).toBe(1);
    } finally {
      restore();
    }
  });

  it("counts links + external scripts + stylesheets", async () => {
    const restore = mockFetchOnce(`
      <html><head>
        <link rel="stylesheet" href="/a.css">
        <link rel="stylesheet" href="https://cdn.example/b.css">
      </head><body>
        <a href="/page-1">L1</a>
        <a href="/page-2">L2</a>
        <a href="https://external">L3</a>
        <script src="/script.js"></script>
        <script src="https://cdn.example/d.js"></script>
        <script>inline()</script>
      </body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.link_count).toBe(3);
      expect(r.external_script_count).toBe(2); // inline doesn't count
      expect(r.external_stylesheet_count).toBe(2);
    } finally {
      restore();
    }
  });

  it("extracts schema.org @type from valid JSON-LD blocks", async () => {
    const restore = mockFetchOnce(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "LocalBusiness", "name": "Co" }
        </script>
        <script type="application/ld+json">
        [
          { "@type": "WebPage" },
          { "@type": ["Article", "BlogPosting"] }
        ]
        </script>
      </head><body></body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.has_schema_org).toBe(true);
      const types = new Set(r.schema_org_types);
      expect(types.has("LocalBusiness")).toBe(true);
      expect(types.has("WebPage")).toBe(true);
      expect(types.has("Article")).toBe(true);
      expect(types.has("BlogPosting")).toBe(true);
    } finally {
      restore();
    }
  });

  it("ignores malformed JSON-LD without crashing", async () => {
    const restore = mockFetchOnce(`
      <html><head>
        <script type="application/ld+json">{ this is not valid json }</script>
      </head><body></body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.fetched).toBe(true);
      expect(r.has_schema_org).toBe(false);
    } finally {
      restore();
    }
  });

  it("flags missing essentials (no title / no meta description / no viewport)", async () => {
    const restore = mockFetchOnce(`
      <html><head></head><body><p>no head tags</p></body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.title).toBe(null);
      expect(r.meta_description).toBe(null);
      expect(r.has_viewport).toBe(false);
      expect(r.has_favicon).toBe(false);
      expect(r.h1_count).toBe(0);
    } finally {
      restore();
    }
  });
});

describe("fetchPageEvidence — platform detection", () => {
  it("detects facebook URLs", async () => {
    const restore = mockFetchOnce(`<html><head><title>FB</title></head></html>`);
    try {
      const r = await fetchPageEvidence("https://www.facebook.com/somepage");
      expect(r.platform).toBe("facebook");
    } finally {
      restore();
    }
  });

  it("detects instagram URLs", async () => {
    const restore = mockFetchOnce(`<html><head><title>IG</title></head></html>`);
    try {
      const r = await fetchPageEvidence("https://instagram.com/user");
      expect(r.platform).toBe("instagram");
    } finally {
      restore();
    }
  });

  it("flags login walls on FB/IG", async () => {
    const restore = mockFetchOnce(`
      <html><head><title>Facebook</title></head>
      <body>You must log in to continue</body></html>
    `);
    try {
      const r = await fetchPageEvidence("https://www.facebook.com/123");
      expect(r.platform).toBe("facebook");
      expect(r.hit_login_wall).toBe(true);
      expect(r.platform_note).toMatch(/login wall/i);
    } finally {
      restore();
    }
  });
});

describe("fetchPageEvidence — error handling", () => {
  it("returns fetched=false on invalid URL", async () => {
    const r = await fetchPageEvidence("not a url");
    expect(r.fetched).toBe(false);
    expect(r.fetch_error).toBeDefined();
  });

  it("returns fetched=false on network failure", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Connection refused");
    };
    try {
      const r = await fetchPageEvidence("https://offline.example");
      expect(r.fetched).toBe(false);
      expect(r.fetch_error).toMatch(/Connection refused/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("captures non-200 status codes", async () => {
    const restore = mockFetchOnce(`<html><head><title>404</title></head></html>`, {
      status: 404,
    });
    try {
      const r = await fetchPageEvidence("https://example.com/missing");
      expect(r.fetched).toBe(true);
      expect(r.status_code).toBe(404);
    } finally {
      restore();
    }
  });

  it("handles non-HTML responses without crashing", async () => {
    const restore = mockFetchOnce("%PDF-1.4 binary garbage", {
      contentType: "application/pdf",
    });
    try {
      const r = await fetchPageEvidence("https://example.com/file.pdf");
      expect(r.fetched).toBe(true);
      expect(r.content_type).toMatch(/application\/pdf/);
      // Document fields should be undefined — we didn't parse HTML
      expect(r.title).toBeUndefined();
    } finally {
      restore();
    }
  });
});

describe("fetchPageEvidence — HTML entity decoding", () => {
  it("decodes common entities in extracted text", async () => {
    const restore = mockFetchOnce(`
      <html><head>
        <title>R&amp;D &quot;Test&quot; &amp; More</title>
        <meta name="description" content="A &amp; B &lt;tag&gt;">
      </head></html>
    `);
    try {
      const r = await fetchPageEvidence("https://example.com");
      expect(r.title).toBe('R&D "Test" & More');
      expect(r.meta_description).toBe("A & B <tag>");
    } finally {
      restore();
    }
  });
});
