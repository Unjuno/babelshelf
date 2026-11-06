# BabelShelf feedback service

The app's Settings → Send feedback form sends only `category`, `message`, and the optional app `build` identifier after the user presses Send. It never attaches chat messages, prompts, Memory files, device identifiers, or diagnostic reports. The endpoint accepts writes only from the configured app origin. There is no public read route.

Feedback is stored in Cloudflare D1. During development, an operator signed in to the Cloudflare account can read it with Wrangler; do not add an in-app or public read endpoint.

## Deployment

The D1 database `babelshelf-feedback` has been created in APAC and migration `0001_create_feedback.sql` has been applied. The Worker is deployed at `https://babelshelf-feedback-api.unjuno-org.workers.dev/v1/feedback`. The domain `babelshelf.com` currently resolves through Porkbun nameservers, so the Worker uses its Cloudflare `workers.dev` hostname and does not change the app's DNS. To deploy code updates, authenticate with the Cloudflare account and run `npx wrangler deploy` from this folder.

The app defaults to the deployed `workers.dev` endpoint above. `VITE_FEEDBACK_API_URL` can override it at build time; an explicitly empty value disables sending. The app still requires browser Online mode and `navigator.onLine`, and sends only after an explicit tap.

## Developer read

Run from the repository root after Wrangler authentication:

```powershell
npx wrangler d1 execute babelshelf-feedback --remote --config feedback-api/wrangler.jsonc --file feedback-api/feedback-read.sql
```

The SQL file is read-only. Read access depends on the operator's Cloudflare account credentials; it is not exposed through the Worker.
