# Architecture & Decisions

## 1. Match Quality & Fit Logic (The 90% Threshold)
**Decision:** A 3-step LLM pipeline using `model-pick` with Structured Outputs (JSON). Testing cheaper model. Later better. Model into .env.
**Why:**
1. **Extract:** Extract the user's core persona/industry from their URL.
2. **Fetch candidates:** Query Podscan for ~15-20 broad podcast candidates based on that persona.
3. **Score & explain:** Pass the user persona + the 20 podcast descriptions back to the LLM. The LLM is instructed to score them (0-100), write a 1-sentence personalised explanation addressing the user directly ("As a B2B SaaS founder, you'll find..."), filter for >= 90%, and return exactly the top 6. 

## 2. UX Polish & HTML Stripping
**Decision:** Strict Zod validation on the frontend and regex-based HTML sanitization on the backend.
**Why:** 
- **Validation:** URLs must be valid, but users often type `domain.com` instead of `https://domain.com`. The UI intercepts this auto appends `https://`, and validates before submitting.
- **HTML striping:** Podscan descriptions often contain messy raw HTML tags (`<p>`, `<a>`, `<br>`). Before passing descriptions to the LLM (which wastes tokens) or the frontend (which breaks layout) I run a standard regex `.replace(/(<([^>]+)>)/gi, "")` to ensure clean, readable text.
- **Latency handling:** Because the LLM pipeline (estimating) that takes ~10sec the frontend uses an animated skeleton loader with dynamic text ("Analysing profile..." -> "Scoring podcasts...") so the user doesn't bounce.

## 3. The LinkedIn Problem
**Decision:** URL slug fallback.
**Why:** LinkedIn strictly blocks scraping (returning 999/403). Rather than failing, if the URL includes `linkedin.com/in/`, I extract the slug (e.g., `jane-doe-b2b-marketing`). The LLM is smart enough to extrapolate a user persona ("B2B Marketing Professional") purely from a well-structured URL slug, ensuring the user still gets a seamless 6-podcast result.
**Future plan:** For more reliable results there are various approaches:
1. Real Mac or Win machine (not Ubuntu server) and non-headless scraper from domestic IP looks less suspicious. Once in a while do some other stuff in LinkedIn, too (out of scope).
2. Use paid proxies (out of scope).
3. Use paid Linkedin profile scraping service (research out of this short demo scope).
4. API access (research out of this short demo scope).

## 4. Email Setup & Reliability
**Decision:** Resend SDK with graceful degradation.
**Why:** Resend is fast and reliable. The email includes a clean HTML template mapping the 6 podcasts and the unsubscribe link. If the Resend API throws an error (e.g., hard bounce, API down), the backend catches it. Because the primary requirement is *also* displaying it on-screen, the user still gets their UI result even if the email temporarily fails. Unsubscribing simply toggles an `is_active` boolean in Supabase, excluding them from the weekly Cron.