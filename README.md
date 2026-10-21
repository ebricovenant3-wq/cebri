# Cebri Curtains & Blinds

A static storefront built with HTML, CSS and JavaScript. The catalogue, search, category filters and cart run in the browser. Supabase provides private storage for quote requests; Cebri reviews each request and confirms the quote and payment instructions manually. The site does not accept or verify payments.

## Local preview

Serve this folder with any static web server, then open `index.html`. The catalogue is at `shop.html`.

## Supabase order backend

The backend is a Supabase Postgres table and Edge Functions. Customer details are stored in `public.orders`; row-level security is enabled and browser clients have no access to read orders. Requests are validated, require customer consent, and are rate-limited. The functions store only salted hashes for rate limits, not raw network addresses. The website also has an AI chat assistant for curtain and blind questions; it does not store chat transcripts in Cebri's database.

Orders remain in the database until you delete them. Review requests in Supabase and remove customer details when you no longer need them.

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. In this project folder, link the project: `supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply the database migrations: `supabase db push`.
4. Configure server-only Edge Function secrets: `ALLOWED_ORIGINS`, `RATE_LIMIT_SALT` (long random value), `OPENAI_API_KEY`, `BUSINESS_EMAIL`, `RESEND_API_KEY`, `ORDER_ALERT_EMAIL`, and `EMAIL_FROM`. Set `ORDER_ALERT_EMAIL` to `ebricovenant3@gmail.com`. `EMAIL_FROM` must be an address on a domain verified with your email provider. Supabase supplies the database URL and service-role key to deployed functions.
5. Deploy the functions: `supabase functions deploy submit-order`, `supabase functions deploy customer-assistant`, `supabase functions deploy whatsapp-assistant`, and `supabase functions deploy email-assistant`.
6. Set `ALLOWED_ORIGINS` to the exact website origin `https://ebricovenant3-wq.github.io`. For local preview also include `http://localhost:8080` and `http://127.0.0.1:8080`; add the computer's LAN origin if testing from a phone. Separate origins with commas. Add any custom domain exactly, including the scheme.
7. In Supabase Auth settings, enable email/password sign-in. Set the site URL and allowed redirects for your published site, including `https://ebricovenant3-wq.github.io/cebri/account.html` and `https://ebricovenant3-wq.github.io/cebri/auth.html`. Update those paths if your GitHub Pages repository URL differs.
8. In `backend-config.js`, set `supabaseUrl` to `https://YOUR_PROJECT_REF.supabase.co` and `supabaseAnonKey` to the project's public anon/publishable key. This key is designed for browser use; never put a service-role/secret key, Resend key, or OpenAI key in website files.
9. Publish the updated site files to GitHub Pages. Signed-in quote requests are attached to the customer account; guest requests still work, but are not shown in account history. Customers can read and update only their own profile and read only their own requests. To grant administrator access, update that user's `profiles.role` from the Supabase SQL editor; the website does not expose role changes.
10. For WhatsApp AI replies, set the server secrets `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, and `META_GRAPH_API_VERSION` in Supabase. Connect a WhatsApp Business Platform Cloud API number in Meta, register the deployed callback `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-assistant`, use the same verify token, and subscribe to incoming `messages`. Meta must be able to reach the deployed HTTPS webhook; the local preview URL cannot receive production webhooks.
11. For AI email replies, enable Resend Receiving and configure a receiving address (Resend-provided or a domain set up for inbound mail). This is a separate inbound route; it does not automatically read the existing Gmail inbox. Add a Resend webhook for `email.received` pointing to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/email-assistant`; save its signing secret as `RESEND_WEBHOOK_SECRET` in Supabase and set `EMAIL_ASSISTANT_ENABLED=true` only after verifying the webhook. Incoming email content is passed to the AI provider and is not stored by this app. Resend receiving webhooks carry the event metadata; the function retrieves the message body from the Receiving API before replying.
12. To receive a business email alert whenever the AI handles a WhatsApp/email message, set `CHANNEL_ALERTS_ENABLED=true` in Supabase. The alert goes to `ORDER_ALERT_EMAIL` (or `BUSINESS_EMAIL`) using the configured Resend sender. Leave it false to disable these conversation alerts.
New quote requests will be saved in Supabase. The function emails Cebri an order alert and sends a customer receipt if the customer entered an email. Review requests and delivery flags in the Supabase dashboard. If email sending fails, the order remains saved. Checkout keeps its WhatsApp/email fallback when the backend is unavailable.

The AI assistant calls OpenAI's Responses API, so each visitor message uses your OpenAI API account and may incur usage charges. ChatGPT subscriptions and API billing are separate. It is limited to catalogue guidance and approved checkout information; it must hand off questions about exact prices, stock, delivery, installation, and payment. Website chat transcripts and WhatsApp/email message bodies are not stored by Cebri; channel event IDs are hashed for webhook deduplication. Messages are processed by the configured providers, and WhatsApp replies require a Meta Business Platform Cloud API account. Resend's Receiving service is required for inbound email replies.

Quote order alerts use email. AI conversation alerts to the business are also sent by email when `CHANNEL_ALERTS_ENABLED=true`. Customer AI replies go through the configured WhatsApp Cloud API or Resend inbound email webhook.

The `supabase/migrations` folder contains the order table, access controls and rate-limit function. `supabase/functions/submit-order` stores orders and sends email alerts. `supabase/functions/customer-assistant` provides the website chat. Supabase supplies the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets to deployed Edge Functions.

## Business settings

Edit `WHATSAPP_NUMBER` and `BUSINESS_EMAIL` at the top of `script.js`. Add verified bank name, account name and account number to `BANK_TRANSFER_DETAILS` only when ready. The checkout requests a quote; Cebri reviews it and shares bank-transfer instructions manually after confirmation. Do not ask customers to transfer before receiving verified details.

## GitHub Pages

This site publishes directly from the repository root and has no build step. In the repository, open **Settings → Pages**, select **Deploy from a branch**, then choose **main** and **/(root)**. See [GitHub's publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Render deployment

`render.yaml` defines a Render static site. Its build copies only the browser files and `assets/` into `dist/`, leaving Supabase function and migration source out of the published directory. In Render, choose **New → Blueprint**, connect this repository, select the repository's default branch, review the static-site service, and deploy it. Render will provide an `onrender.com` URL after the build completes.

After deployment, add the exact Render origin (for example, `https://your-site.onrender.com`) to Supabase's `ALLOWED_ORIGINS`. Set the Supabase Auth **Site URL** and allowed redirect URLs to the Render origin plus `/auth.html` and `/account.html`. Deploy the database migrations and Edge Functions separately through the Supabase CLI. Put OpenAI, Resend, Meta, and webhook secrets in Supabase Edge Function secrets; the Render static site does not need those server credentials.
