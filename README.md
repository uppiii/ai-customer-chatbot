# Aura Skincare AI Voice Agent

## Short approach note
This project is a browser-based AI voice support agent for Aura Skincare. It uses the browser’s built-in speech recognition and speech synthesis so the evaluator can start a call, talk naturally, and get spoken responses without any telephony setup. The agent includes structured guardrails for brand policy, order lookup, and end-of-call transcript summarization.

## Why this architecture
I chose a lightweight browser-first architecture because the assignment requires an evaluator to test the experience without telephony setup. The voice pipeline uses the browser's Web Speech APIs for speech recognition (STT) and speech synthesis (TTS), with a deterministic, local intent-and-tool layer between them. This keeps the prototype fast, key-free, and policy-consistent; it is a transparent demo implementation rather than a hosted LLM integration. The modules separate voice interaction, mock tools, policy rules, and summary generation so an LLM or streaming speech provider can be added later without changing the UI contract.

## Most difficult part and solution
The hardest part was balancing a conversational follow-up flow with strict policy guardrails. For example, an order-tracking request may arrive before the customer provides an order ID, or a return depends on delivery date and product condition. I use named deterministic tools over the mock database and preserve pending intent across turns; when required information is missing or the order cannot be found, the agent asks rather than inventing an answer. The demo checks cancellation eligibility but does not submit real order changes.

## If I had one more week
I would replace browser-only speech recognition with a streaming speech service for more consistent microphone support and lower end-to-end latency, then add a hosted LLM behind constrained tool calling and evaluation tests. I would also connect authenticated order data and a real cancellation workflow. The present Hinglish option depends on the recognition voices/languages available in the evaluator's browser and device.

## Optional features implemented
- **Turn-taking and interruption:** The microphone recognizer pauses while Aria speaks to prevent the browser from transcribing its own audio. The customer can stop a response with the **Interrupt Aria** button, then speak; this explicit control is more reliable than trying to listen to the microphone and play speech at the same time in browser APIs.
- **Hinglish:** A visible English (India) / Hinglish-Hindi selector configures speech recognition, speech output, and concise response templates.
- **Multiple tools:** The local tool registry exposes `get_order_details`, `get_product_details`, `check_cancellation_eligibility`, `check_return_eligibility`, `get_shipping_quote`, and `check_cod_eligibility`.
- **Product questions:** Product-name lookups identify sample products and state clearly when ingredients, benefits, suitability, or directions are not included in the supplied data.
- **Ambiguity handling:** Missing order IDs and missing return-condition details trigger a focused clarification; a subsequently provided order ID is applied to the pending request, including multi-turn return checks.
- **Improved call experience:** Quick-question chips, live call timer, readable transcript, summary copy, and transcript clearing.
- **Demo recording:** The app includes a browser screen/tab recorder that downloads a WebM video. It records selected tab audio by default to prevent Aria being picked up twice; microphone narration is optional and requests browser echo cancellation.
- **Low latency:** Intent matching and mock tools run locally without network/LLM round trips or artificial response delay.
- **Multi-brand:** Not added; the assignment evaluates Aura Skincare only, so adding brand selection would add scope without improving this test.

## Final assignment checklist

### Completed in this workspace
- Browser-based voice conversation interface and call controls
- Brand policies, mock order lookup, and invalid-order handling
- Transcript and structured call summary
- Hinglish mode, turn-taking/interrupt control, and clarification flow
- Multiple support tools, quick actions, and call timer
- Automated tests pass (22 tests), including mixed-intent routing, multi-turn product questions, and transcript-based summaries; browser UI checked
- GitHub Pages workflow prepared; it runs tests before publishing the static app
- 4-minute demo video recording script prepared
- Setup instructions and project documentation

### Still required for submission
- Create a GitHub repository and push this workspace to its `main` branch
- Enable GitHub Pages using **GitHub Actions** in the repository's Pages settings; the workflow then publishes the public URL
- Record and upload the 3–5 minute demo using [DEMO-SCRIPT.md](DEMO-SCRIPT.md), then add its link
- Add the candidate's LinkedIn profile URL
- Email the application URL, repository URL, video URL, LinkedIn URL, and approach note to the addresses in the assignment PDF

Multi-brand selection is intentionally out of scope because the assignment specifies only Aura Skincare. Voice uses half-duplex turn-taking to avoid the microphone picking up the agent's own speech; the customer can press **Interrupt Aria** before speaking during a response.

## Project setup
1. Open a terminal in this folder.
2. Run `npm start`. This starts the local server and opens the app in Microsoft Edge if installed, otherwise Google Chrome. If neither is found in its standard install folder, it uses your system default browser.
3. If it does not open automatically, navigate to `http://127.0.0.1:3000/`. Do not use `http://[::]:3000/`; `[::]` is a server bind address, not a browser URL.
4. Click **Start Call** and allow microphone access. Manual input is available if speech recognition is unsupported.
5. To record a demo, click **Start recording**, choose the current browser tab, and turn on **Share tab audio** in the browser's share dialog. Confirm the app status says **Recording tab audio**. Keep **Also capture microphone narration** unchecked for the cleanest agent audio; enable it only with headphones. Click **Stop and download** when finished; the recording is saved as a WebM file.

Run the automated tests with `npm test` (requires Node.js).

## Public deployment preparation
The app is static and has no backend or required API keys. A GitHub Pages workflow is prepared at `.github/workflows/deploy-pages.yml`; on pushes to `main`, it runs `npm test` and publishes only the static site files. To activate it, create a GitHub repository, push the project to `main`, and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow will then provide the public site URL in its successful deployment run. No GitHub account or remote is configured in this workspace, so the repository cannot be published from here.

## Files included
- `index.html` — app shell and interface
- `styles.css` — UI styling
- `src/agent.js` — brand rules, order database, and support tools
- `src/app.js` — browser event wiring and voice interaction flow
- `tests/agent.test.js` — order, policy, tool, and Hinglish tests
- In-app **Demo video recorder** — capture the app tab/screen with available audio to WebM
- `DEMO-SCRIPT.md` — timed guide for the required 3–5 minute walkthrough
- `SUBMISSION-EMAIL.md` — email template with required submission fields
- `.github/workflows/deploy-pages.yml` — test-before-deploy GitHub Pages workflow

## Notes
This implementation does not require external API keys or telephony. Speech recognition support varies by browser; Chrome/Edge are recommended, and the manual input remains available as a fallback. Order data is fictional and in-memory. This is an assignment demo, not a production order-management system.
