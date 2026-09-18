# **What You'll Build** 

A ready mini-product deployed to a live URL where a person enters their website or LinkedIn URL and email. The system displays on-screen and emails them an AI-curated list of exactly 6 highly relevant podcasts—each holding a match score of 90% or higher—along with personalized explanations detailing why each show is a great fit. It stores the signup and supports a recurring weekly resend schedule. 

# **Core Focus Areas We Are Evaluating** 

- **Match Quality & Fit Logic:** How you analyze the user's profile and construct explicit criteria to select exactly 6 podcasts with a 90%+ fit score and personalized fit explanations. 
- **Email Setup & Reliability:** Proper Resend integration, clean email formatting, working unsubscribe logic, and resilient handling of send errors. 
- **Design Choices & UX Taste:** Polished layout, input validation for wrong/malformed URLs, graceful state handling, and stripping messy raw HTML tags from Podscan metadata. 

# **The Flow** 

1. A user visits your live URL, enters a website or LinkedIn URL and their email, and submits. 
2. The system analyzes the profile using an LLM (OpenAI/Anthropic, e.g., via OpenRouter). 
3. It fetches candidate shows from Podscan, evaluates them against custom fit criteria, and isolates exactly 6 podcasts that meet a 90%+ match score threshold. 
4. It displays the 6 podcasts on the page along with a short, smart "Why it's a fit" explanation tailored to that specific user. 
5. It emails the curated list and fit explanations to the user via Resend, including a working unsubscribe link. 
6. It stores the signup and provides a route or cron to trigger a weekly resend path. 

# **Technical Requirements** 

- **Stack:** Any stack you are fastest in. 
- **Email:** Resend. 
- **Deployment:** Must be deployed to a live, public URL (Render, Railway, Fly, Vercel, etc.) so anyone can open the link and test the complete workflow end-to-end. 
- **Environment Variables:** Podscan API key, LLM API key (OpenAI/Anthropic/OpenRouter), Resend API key, Database URL, Base URL. 

# **Out of Scope** 

No login, payments, pitch writing, host emailing, or admin dashboards beyond viewing signups via a simple CSV export or endpoint. 

# **How We Grade** 

- **Match Quality & Fit Logic (35%):** Ability to evaluate relevance, enforce 90%+ match scores, and produce exactly 6 tailored recommendations with sharp fit explanations. 
- **UX Polish & Design Taste (25%):** Input validation for bad URLs, clean UI layout, and stripping ugly HTML tags from external metadata. 
- **Email Setup & Reliability (20%):** Clean Resend setup, proper email rendering, working unsubscribe links, and graceful send error handling. 
- **Live Product Execution (10%):** Fully working, deployed mini-product that functions seamlessly when shared via URL. 
- **Questions Asked Before Starting (10%):** Quality and clarity of questions asked before building. 

# **Budget** 

**$50 flat (Goodwill / Paid Interview).** We value clean design taste, smart match criteria, and reliable execution over feature volume. 

# QA

Updated questions with my suggestions. I will start probably developing before I get answers from you so I will go with those suggestions assuming that you rather want to see my ability to ask the right questions, than building the exact thing according to your answers:

1. Is the weekly overlap ok for podcasts as long as we send from the same podcast new episodes or there shall be every week new podcast suggestions? I guess new episodes is the approach but just to make sure.
2. If a user submits multiple times with the same email but a different URL, should we update their existing topics or reject the duplicate? I guess inform user and ask if they want also this URL suggestions?
3. Does the 6-podcast limit need to be exact or is 'up to 6' acceptable if their scraped niche is extremely narrow - Podscan returns fewer results that meet the strict 90%+ match score threshold and we decide there's rather less quality content to send? Suggestion: let the user optionally decide on the next screen where results seen. Default: send more (user sees in email score and can skip the crap).
4. If a LinkedIn URL strictly blocks scraping then is it acceptable to parse the URL slug for keywords or would you prefer a UI fallback where we show them a message eg. 'We couldn't read your profile, click here to enter your interests'? I would probably even give in the first place the ability to manually enter interests, too (it is my interest to get the best suggestions).
5. Since the updated flow requires scoring matches, writing personalised explanations and displaying them then this might take 8-10sec to process. Is a polished animated loading state (eg. "Analysing profile..." -> "Scoring matches...") acceptable for the UX? Suggestion: yes.