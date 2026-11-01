KARP AI setup

KARP AI is a separate olympiad-mathematics tutor. Its browser client calls Firebase callable functions; the Gemini key is stored only as a Firebase Secret and never appears in public website files.

ONE-TIME SETUP

1. Open Google AI Studio and create a Gemini API key:
   https://aistudio.google.com/apikey

2. In Firebase Console, make sure project able-2ca24 is on the Blaze plan. Firebase Cloud Functions production deployment requires Blaze. Set a small budget alert in Google Cloud Billing before launch.

3. In CMD, from the KARP project folder, run:
   cd /d "C:\Users\Murad\Desktop\ABLE"
   firebase functions:secrets:set GEMINI_API_KEY

   Paste the Gemini key when the CLI prompts for it. Do not put the key in ai.js, karp-firebase.js, GitHub, or any HTML file.

4. Install and deploy the isolated AI backend and the website:
   cd functions
   npm install
   cd ..
   firebase deploy --only functions,hosting

The functions use the europe-west1 region and the Gemini gemini-3.1-flash-lite model (the low-cost model selected for the initial trial).

CURRENT SAFEGUARDS

- Sign-in and verified email are required.
- Each account gets 10 AI messages per day, resetting at 00:00 in Asia/Baku.
- The daily allowance is enforced inside a server-side Firestore transaction, not in browser JavaScript.
- The AI is instructed to answer only olympiad mathematics and mathematical-contest preparation questions.
- Image and PDF uploads are limited to 4 MB and supported types.
- Conversation history is kept in the signed-in user's browser storage; daily usage counts are stored server-side in the private karpAiDailyUsage collection.
- The function is capped at 3 instances; Gemini output is capped at 4,096 tokens.

For a normal website-only update in the future, use firebase deploy --only hosting. To remove KARP AI, remove its nav link, ai.html, ai.css, ai.js, the /ai rewrite, and the two functions, then deploy Hosting and Functions.
