# BizAssist — WhatsApp Business Automation

A Flask starter for a team managing customer WhatsApp conversations and routine follow-up tasks.

## WhatsApp Business Platform

BizAssist is being built for the WhatsApp Business Platform: an API-based way for a business system to send and receive WhatsApp messages and connect them to tools such as a CRM or support dashboard. The Cloud API is hosted by Meta, so a business does not run the WhatsApp messaging infrastructure itself. The WhatsApp Business mobile app is a separate product. Meta's On-Premises API is deprecated, so this project targets Cloud API for a new integration. See Meta's [Cloud API overview](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [platform features](https://whatsappbusiness.com/products/business-platform-features/), and [webhook documentation](https://www.postman.com/meta/whatsapp-business-platform/folder/lboq68h/webhooks).

The platform supports API-based customer messages, media and templates, while webhooks deliver subscribed events to a business endpoint. BizAssist will use these pieces for support conversations, order updates, automation, and staff handover as the integration is completed.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app app run --debug
```

Then open <http://127.0.0.1:5000>. The Flask server renders `templates/dashboard.html` and serves the dashboard assets from `static/`.

The dashboard still uses sample conversation and task data in the browser. Its Orders view can read the latest 100 quote requests from Cebri's existing Supabase `orders` table. SQLite is initialized locally for BizAssist customer, enquiry, and order records; the app can also use PostgreSQL through `DATABASE_URL`. The webhook code is implemented, but Meta must still be configured to send events to a deployed HTTPS callback. Copy `.env.example` to `.env` to configure local settings. Never commit `.env` or real credentials.

## Deployment costs

For a real company deployment, budget separately for hosting, monitoring, backups, AI usage, and any paid messaging or provider charges. WhatsApp Business Platform rates depend on the recipient's market and message category, and Meta's pricing rules can change. Check the [official WhatsApp Business Platform pricing page](https://whatsappbusiness.com/products/platform-pricing/) before preparing a client quote.

## Portfolio completion goals

- [ ] Connect a customer-support chatbot through the official WhatsApp Business Platform API.
- [ ] Build dashboard views for customer records, orders, follow-ups, and activity.
- [ ] Persist validated customer enquiries and orders, with safe error handling.
- [ ] Add AI-assisted replies grounded in approved company information, with human handover for uncertain or complex requests.
- [ ] Add automated tests, setup instructions, and a clear project README.
- [ ] Record a short demo showing a customer enquiry becoming a saved order.

The current version is an early scaffold: it has the Flask dashboard, starter SQLite tables, and sample front-end interactions. The portfolio goals above describe the work still needed before presenting it as a finished business automation system.

## Deployment security

In production, the dashboard and staff APIs require the `BIZASSIST_ADMIN_TOKEN`. Staff can open the dashboard using the browser's HTTP Basic prompt with the token as the password, or call the APIs with an `Authorization: Bearer <BIZASSIST_ADMIN_TOKEN>` header. The Render Blueprint generates this token. Keep it in a server-side secret store; do not put it in browser JavaScript or a public dashboard. Local development without `APP_ENV=production` keeps the demo APIs convenient for fictional-data exercises. Real order access is disabled unless its Supabase configuration and staff token are present.

### Show Cebri's real quote requests

Configure these server-side variables in the ignored `bizassist/.env` for local use, or in the BizAssist Render service environment settings:

- `CEBRI_SUPABASE_URL`: the Supabase project URL already used by the Cebri storefront.
- `CEBRI_SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key for that same project. This key bypasses row-level security, so keep it only on the server and never use the public anon key here.
- `BIZASSIST_ADMIN_TOKEN`: a long random staff token. Render's Blueprint generates one; for local use, generate and store one privately.

Restart the Flask app after configuring local variables, open `/dashboard`, and choose **Orders**. The Orders view is read-only, requests the latest 100 records, and only returns each order's reference, date, status, customer name, phone number, and requested items. It omits customer email, delivery address, and notes. Cebri's quote requests do not contain confirmed prices, so the dashboard does not invent order totals. If the integration variables are absent, the view reports that order access is not configured. The service-role key is never sent to the browser.

Use fictional customer records in public demos. Do not publish real customer names, phone numbers, enquiries, or order history.

## Render deployment preparation

`bizassist/render.yaml` is a separate Render Blueprint for the Flask backend and a managed PostgreSQL database. It leaves the repository's root `render.yaml` for the existing static storefront unchanged. In Render, create a Blueprint from this repository and set the Blueprint path to `bizassist/render.yaml`. Review the service and database plans, region, and names before syncing; the selected web service and PostgreSQL plans can incur charges. The Blueprint has automatic deploys disabled so future code pushes do not deploy without a manual action.

The backend service uses Python, installs `requirements.txt`, starts with Gunicorn, and binds to Render's `$PORT`. It creates its tables in the connected PostgreSQL database at startup. The Blueprint generates `FLASK_SECRET_KEY` and `BIZASSIST_ADMIN_TOKEN` and wires the private database connection into `DATABASE_URL`. Set `CEBRI_SUPABASE_URL` and `CEBRI_SUPABASE_SERVICE_ROLE_KEY` in the backend service's environment settings to enable the read-only Cebri Orders view. Add `WHATSAPP_VERIFY_TOKEN` and `META_APP_SECRET` as secrets in the Render service settings before registering the Meta webhook; the webhook returns an error until these are configured. Never put secret values in this file, in Git, or in chat. Existing local SQLite data is not automatically copied into PostgreSQL.

Before syncing a Blueprint, verify its service and database names do not match existing resources in the selected workspace; Render may apply a Blueprint to an existing resource with the same name. Do not sync or deploy until you have reviewed the proposed changes. This repo's existing static service configuration must remain separate from this backend Blueprint.

### Connect Meta after the backend is deployed

Render hosting does not connect a WhatsApp number to Meta. In the Meta developer app, configure the callback URL as `https://<your-render-service>.onrender.com/webhook`, use the exact `WHATSAPP_VERIFY_TOKEN` stored in Render, and subscribe the webhook to the `messages` field. Store the Meta app secret in `META_APP_SECRET`; the server checks Meta's request signature before accepting messages. Do not send either secret through chat or place them in client-side code.

Inbound webhooks and order persistence are implemented. Outbound sending is only a helper at present; automated replies are not wired into incoming-message handling. `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `META_GRAPH_API_VERSION` are needed for the helper and should be added as Render secrets only when outbound sending is intentionally enabled.

## WhatsApp Cloud API development

The Flask app has a Meta webhook at `/webhook`. Configure a Meta developer app with the WhatsApp product, set a private verify token and app secret in `.env`, then register an HTTPS callback URL ending in `/webhook` and subscribe it to `messages`. Meta's verification request is answered with the challenge only when its verify token matches. Incoming POST events are checked against `X-Hub-Signature-256` using the app secret; accepted messages are saved as local enquiries and repeated webhook deliveries are deduplicated by message ID. See Meta's [WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/) and [Graph API webhook documentation](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/).

Meta needs to reach the callback over public HTTPS; a loopback address such as `127.0.0.1` is not reachable by Meta. For local webhook development, start a separate server with `WEBHOOK_ONLY_MODE=true FLASK_DEBUG=false PORT=5002 .venv/bin/python app.py`, then point a temporary HTTPS tunnel only at port `5002`. In this mode the server returns 404 for every route except `/webhook`, keeping the unauthenticated order and message-inspection APIs off the public tunnel. Stop the tunnel after testing. The local inspection endpoint remains available on the normal local server at `GET /api/whatsapp/messages`.

To send one test message, configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `META_GRAPH_API_VERSION` in `.env`, then run `python send_test_message.py RECIPIENT_IN_INTERNATIONAL_FORMAT "Test message"` with a permitted test recipient. Keep all credentials server-side and out of source control. Do not send a test until the recipient is approved in the Meta developer setup.

### Connection checklist

- [ ] Create a Meta developer app and add the WhatsApp product.
- [ ] Set up a WhatsApp test number and allow a test recipient.
- [ ] Add the access token, phone number ID, app secret, verify token, and Graph API version to the ignored local `.env` file.
- [x] Implement Flask webhook verification, signature validation, inbound-message storage, and duplicate-delivery handling for local development.
- [ ] Send a test message through the Cloud API.
- [ ] Receive a real test message through the public HTTPS webhook and confirm it is saved as an enquiry.
- [ ] Add automated replies grounded in approved business information and a human handover path.
