# Load tests (k6)

These are HTTP load tests that run against either the local dev server
or a deployed environment (preview / staging / prod).

## Install k6

k6 is a separate binary — it's not a Node package. Install it once:

**Windows (Chocolatey):**

```powershell
choco install k6
```

**macOS (Homebrew):**

```bash
brew install k6
```

**Linux:**

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

Verify:

```bash
k6 version
```

## Run

Against a local `npm run dev`:

```bash
# Terminal 1
npm run dev

# Terminal 2
k6 run tests/load/landing.js
k6 run tests/load/login-page.js
```

Against a deployed environment:

```bash
k6 run -e BASE_URL=https://nidham.app tests/load/landing.js
```

## Interpret results

k6 prints a summary at the end:

```
   ✓ status is 200
   ✓ body contains the brand letter
   ✓ response under 800ms

   http_req_duration..............: avg=320ms  p(95)=720ms
   http_req_failed................: rate=0.00%
```

If `http_req_duration p(95)` exceeds the configured threshold, the test
exits non-zero — that's the signal CI uses. Fix the regression before
shipping.

## Adding a new load test

Copy `landing.js` as a template. The key knobs:

- `stages` — virtual-user ramp profile
- `thresholds` — what counts as failure
- The default exported function = what each VU runs per iteration
- `sleep()` — pause between iterations to mimic a real user

Don't run load tests against production unless you've coordinated with
the team — k6 can easily push past Vercel's rate limits and trigger a
billable spike.
