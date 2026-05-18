// ============================================================================
// k6 load test — public login page (/login)
// ============================================================================
//
// The login page is the second-most-trafficked anonymous page after the
// landing. This test verifies it can serve a burst of arrivals (e.g. a
// notification email that says "حضورك تم اعتماده، ادخل" lands and 100
// employees click within the same minute).
//
// Run with:   k6 run tests/load/login-page.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  // Spike test: 100 users all hitting login in 5 seconds, then sustain
  // for 20s while we measure how the page degrades under sustained load.
  stages: [
    { duration: "5s", target: 100 },
    { duration: "20s", target: 100 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.02"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/login`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "renders the login form": (r) =>
      typeof r.body === "string" &&
      r.body.includes("الإيميل") &&
      r.body.includes("كلمة السر"),
  });

  sleep(Math.random() * 1.5 + 0.5);
}
