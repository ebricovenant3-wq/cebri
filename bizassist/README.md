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

The dashboard still uses sample conversation data in the browser. SQLite is initialized locally for customer, enquiry, and order records; WhatsApp is not connected yet. Copy `.env.example` to `.env` to configure local settings. Never commit `.env` or real credentials.

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

## Deployment security requirement

The order API is for local development only. Before deploying it for a company, add authentication and access controls, stronger validation, and appropriate protections for customer data. Do not expose the current order endpoints publicly until those protections are in place.

Use fictional customer records in public demos. Do not publish real customer names, phone numbers, enquiries, or order history.

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
