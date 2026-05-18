// ============================================================================
// k6 load test — public landing page (/)
// ============================================================================
//
// Run with:
//   k6 run tests/load/landing.js
// Or against staging:
//   k6 run -e BASE_URL=https://nidham.app tests/load/landing.js
//
// What we're measuring:
//   • p95 latency under modest load (50 concurrent users for 30s)
//   • error rate stays under 1%
//   • the response actually contains the rendered React payload
//     (catches the "200 OK with empty body" failure mode on Vercel
//     when the function panics after writing the status code)

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  // Ramp the virtual-user count to mimic an organic morning launch:
  //   0 -> 10 over 10s   (warm-up)
  //   10 -> 50 over 20s  (peak)
  //   50 -> 0 over 10s   (cool-down)
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    // Hard SLO: 95% of requests under 800ms. Tighten this once the
    // landing page is on the edge runtime.
    http_req_duration: ["p(95)<800"],
    // Hard SLO: less than 1% error rate.
    http_req_failed: ["rate<0.01"],
  },
  // Don't print every single request — only summary at the end.
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    headers: {
      "Accept-Language": "ar-EG",
      "User-Agent": "k6-load-test (Nidham landing-page baseline)",
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "body contains the brand letter": (r) =>
      typeof r.body === "string" && r.body.includes("نِظام"),
    "response under 800ms": (r) => r.timings.duration < 800,
  });

  // Spread requests out — a real visitor doesn't refresh in a tight loop.
  sleep(Math.random() * 2 + 1);
}
