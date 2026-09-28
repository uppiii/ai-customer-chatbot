# 3–5 Minute Demo Video Script

Target length: about 4 minutes. Use the app's **Demo video recorder** panel: click **Start recording**, select the current browser tab, and turn on **Share tab audio** in the browser's share dialog. Confirm the app says **Recording tab audio**. Leave **Also capture microphone narration** unchecked to avoid recording Aria twice; your questions still appear in the transcript. If you need live narration in the recording, use headphones before enabling the mic option. Use a quiet room and Chrome or Edge. The sample orders are fictional. Click **Stop and download** after the walkthrough; check playback before uploading.

## 0:00–0:25 — Introduction
- Show the app title and explain that it is Aura Skincare’s browser-based customer-support voice agent.
- Point out Start Call, End Call, the live state, language mode, and test-order helper.

## 0:25–1:15 — Voice order lookup
- Click Start Call and wait until Aria finishes her greeting and the state returns to Listening.
- Ask: “Where is my order ORD-101?”
- Show the transcript and explain that the local order lookup returns the courier and expected delivery time.

## 1:15–2:00 — Policy guardrail
- Ask: “Can I return ORD-102? It was delivered 14 days ago.”
- Show that the agent declines the return under Aura’s 7-day policy instead of promising a refund.

## 2:00–2:35 — Cancellation eligibility and product-data limits
- Ask whether ORD-103 can be cancelled. Explain that it is Processing and the demo checks eligibility, but does not submit a real cancellation.
- Ask about Green Tea Face Wash + Toner. Show that the agent names the product and does not invent ingredients or benefits missing from the supplied data.

## 2:35–3:15 — Transcript and call summary
- End the call and show the chronological transcript and structured JSON summary.
- Point out the captured intent, order ID, outcome, and summary.

## 3:15–4:00 — Architecture walkthrough
- Explain the flow: browser speech recognition (STT) → deterministic intent and local support tools → browser speech synthesis (TTS).
- Mention that the prototype does not use a hosted LLM or real order-management backend, so responses are predictable and local but less flexible than an LLM-based production system.
- Briefly show the source modules and tests if time allows.

## Before uploading
- Confirm the voice and microphone work in the recorded browser.
- Ensure no personal information, account tokens, or secrets are visible.
- Upload the video somewhere accessible and paste its public link into the assignment email.
