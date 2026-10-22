"""Small helpers for Meta's WhatsApp Business Platform Cloud API."""

import hashlib
import hmac
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def verify_webhook_signature(raw_body, signature_header, app_secret):
    """Check Meta's HMAC-SHA256 signature against the exact raw request body."""
    if not raw_body or not signature_header or not app_secret:
        return False
    if not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def extract_incoming_messages(payload):
    """Yield incoming WhatsApp messages from Meta's webhook event envelope."""
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            contacts = {
                contact.get("wa_id"): contact.get("profile", {}).get("name")
                for contact in value.get("contacts", [])
            }
            for message in value.get("messages", []):
                sender = message.get("from")
                message_id = message.get("id")
                if not sender or not message_id:
                    continue
                kind = message.get("type", "unknown")
                body = message.get("text", {}).get("body")
                if not body:
                    body = f"[{kind} message]"
                yield {
                    "phone": sender,
                    "name": contacts.get(sender) or sender,
                    "message": body,
                    "message_id": message_id,
                }


def send_text_message(recipient, text):
    """Send a WhatsApp text message using credentials held in server env vars."""
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    api_version = os.getenv("META_GRAPH_API_VERSION", "").strip()
    if not access_token or not phone_number_id or not api_version:
        raise RuntimeError("Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and META_GRAPH_API_VERSION.")
    if not re.fullmatch(r"v\d+\.\d+", api_version):
        raise RuntimeError("META_GRAPH_API_VERSION must use the format vNN.N.")
    if not re.fullmatch(r"\+?\d{8,20}", str(recipient)):
        raise ValueError("Recipient must be a phone number in international format.")
    if not isinstance(text, str) or not text.strip() or len(text) > 4096:
        raise ValueError("Message must contain 1 to 4096 characters.")

    endpoint = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    body = json.dumps({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": str(recipient).lstrip("+"),
        "type": "text",
        "text": {"preview_url": False, "body": text.strip()},
    }).encode("utf-8")
    request = Request(endpoint, data=body, headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }, method="POST")
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"WhatsApp API returned HTTP {error.code}.") from None
    except URLError:
        raise RuntimeError("Could not reach the WhatsApp API.") from None
