"""Flask entry point for the BizAssist dashboard."""

import os
import hmac
import json
from functools import wraps
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request as UrlRequest, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from database import (
    DATABASE_ERRORS,
    INCOMING_MESSAGE_ERRORS,
    get_incoming_messages,
    get_orders,
    initialize_database,
    save_incoming_message,
    save_order,
)
from whatsapp import extract_incoming_messages, verify_webhook_signature

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
app.config["APP_ENV"] = os.getenv("APP_ENV", "development").strip().lower()
secret_key = os.getenv("FLASK_SECRET_KEY", "").strip()
if app.config["APP_ENV"] == "production" and not secret_key:
    raise RuntimeError("FLASK_SECRET_KEY must be configured in production.")
app.config["SECRET_KEY"] = secret_key or "local-development-only"
app.config["WEBHOOK_ONLY_MODE"] = os.getenv("WEBHOOK_ONLY_MODE", "false").lower() == "true"
app.config["DATABASE_URL"] = os.getenv("DATABASE_URL", "").strip()
app.config["CEBRI_SUPABASE_URL"] = os.getenv("CEBRI_SUPABASE_URL", "").strip().rstrip("/")
app.config["CEBRI_SUPABASE_SERVICE_ROLE_KEY"] = os.getenv(
    "CEBRI_SUPABASE_SERVICE_ROLE_KEY", ""
).strip()
database_path = Path(os.getenv("DATABASE_PATH", "bizassist.sqlite3"))
app.config["DATABASE_PATH"] = str(database_path if database_path.is_absolute() else BASE_DIR / database_path)


def staff_api_required(view):
    """Require the staff token; browsers can use it through an HTTP Basic prompt."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        expected_token = os.getenv("BIZASSIST_ADMIN_TOKEN", "").strip()
        if not expected_token:
            real_data_configured = bool(
                app.config["CEBRI_SUPABASE_URL"]
                and app.config["CEBRI_SUPABASE_SERVICE_ROLE_KEY"]
            )
            if app.config["APP_ENV"] == "production" or real_data_configured:
                return jsonify({"error": "API access is not configured."}), 503
            # Keep local learning and fictional-data demos convenient.
            return view(*args, **kwargs)

        authorization = request.authorization
        supplied_token = ""
        if authorization and authorization.type.lower() == "bearer":
            supplied_token = authorization.token or ""
        elif authorization and authorization.type.lower() == "basic":
            supplied_token = authorization.password or ""

        if not supplied_token or not hmac.compare_digest(
                supplied_token.encode("utf-8"), expected_token.encode("utf-8")):
            return jsonify({"error": "Authentication required."}), 401, {
                "WWW-Authenticate": 'Basic realm="Cebri staff dashboard", charset="UTF-8"'
            }
        return view(*args, **kwargs)
    return wrapped


@app.before_request
def restrict_webhook_tunnel():
    """When tunnelling for Meta, expose only the signature-checked webhook."""
    if app.config["WEBHOOK_ONLY_MODE"] and request.path != "/webhook":
        return "Not found", 404


@app.get("/")
def home():
    return jsonify({
        "project": "BizAssist",
        "status": "running",
        "message": "Business automation server is ready",
    })


@app.get("/health")
def health():
    return jsonify({"healthy": True})


@app.get("/dashboard")
@staff_api_required
def dashboard():
    return render_template("dashboard.html")


@app.get("/api/cebri/orders")
@staff_api_required
def list_cebri_orders():
    """Read the latest Cebri quote requests using the server-only Supabase key."""
    supabase_url = app.config["CEBRI_SUPABASE_URL"]
    service_role_key = app.config["CEBRI_SUPABASE_SERVICE_ROLE_KEY"]
    if not supabase_url or not service_role_key:
        return jsonify({"error": "Cebri order access is not configured."}), 503

    parsed_url = urlparse(supabase_url)
    if (parsed_url.scheme not in ("https", "http") or not parsed_url.netloc
            or (app.config["APP_ENV"] == "production" and parsed_url.scheme != "https")):
        return jsonify({"error": "Cebri order access is not configured."}), 503

    query = urlencode({
        "select": "id,created_at,status,customer_name,customer_phone,items",
        "order": "created_at.desc",
        "limit": "100",
    })
    request_url = f"{supabase_url}/rest/v1/orders?{query}"
    upstream_request = UrlRequest(request_url, headers={
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    })

    try:
        with urlopen(upstream_request, timeout=10) as response:
            upstream_orders = json.loads(response.read().decode("utf-8"))
        if not isinstance(upstream_orders, list):
            raise ValueError("Unexpected order response")
    except HTTPError as error:
        app.logger.warning("Cebri order service returned HTTP %s", error.code)
        return jsonify({"error": "Cebri orders could not be loaded."}), 502
    except (URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        app.logger.exception("Could not load Cebri orders")
        return jsonify({"error": "Cebri orders could not be loaded."}), 502

    # Return only fields needed for the staff list; omit addresses, notes, and email.
    orders = []
    for row in upstream_orders:
        if not isinstance(row, dict):
            continue
        items = row.get("items")
        safe_items = []
        if isinstance(items, list):
            for item in items:
                if (isinstance(item, dict) and isinstance(item.get("name"), str)
                        and isinstance(item.get("quantity"), int)
                        and not isinstance(item.get("quantity"), bool)):
                    safe_items.append({
                        "name": item["name"][:120],
                        "quantity": item["quantity"],
                    })
        orders.append({
            "id": str(row.get("id", ""))[:80],
            "created_at": str(row.get("created_at", ""))[:40],
            "status": str(row.get("status", "pending"))[:30],
            "customer_name": str(row.get("customer_name", ""))[:100],
            "customer_phone": str(row.get("customer_phone", ""))[:30],
            "items": safe_items,
        })

    result = jsonify({"orders": orders})
    result.headers["Cache-Control"] = "no-store"
    return result


@app.post("/api/orders")
@staff_api_required
def create_order():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    name = data.get("name")
    phone = data.get("phone")
    product = data.get("product")
    quantity = data.get("quantity")
    unit_price = data.get("unit_price")

    if not all([name, phone, product, quantity is not None, unit_price is not None]):
        return jsonify({"error": "All order fields are required."}), 400

    if not all(isinstance(value, str) and value.strip() for value in (name, phone, product)):
        return jsonify({"error": "Name, phone and product must be text."}), 400

    if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 10000:
        return jsonify({"error": "Invalid quantity."}), 400

    if (isinstance(unit_price, bool) or not isinstance(unit_price, (int, float))
            or not 0 <= unit_price <= 1_000_000_000):
        return jsonify({"error": "Invalid unit price."}), 400

    try:
        order_id = save_order(name.strip(), phone.strip(), product.strip(), quantity, unit_price)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except DATABASE_ERRORS:
        app.logger.exception("Could not save order")
        return jsonify({"error": "The order could not be saved. Please try again."}), 500

    return jsonify({
        "message": "Order saved successfully.",
        "order_id": order_id,
        "total": quantity * unit_price,
        "currency": "NGN",
        "status": "Pending",
    }), 201


@app.get("/api/orders")
@staff_api_required
def list_orders():
    try:
        return jsonify({"orders": get_orders()})
    except DATABASE_ERRORS:
        app.logger.exception("Could not retrieve orders")
        return jsonify({"error": "Orders could not be loaded. Please try again."}), 500


@app.get("/webhook")
def verify_whatsapp_webhook():
    """Complete Meta's webhook subscription verification handshake."""
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    mode = request.args.get("hub.mode", "")
    supplied_token = request.args.get("hub.verify_token", "")
    challenge = request.args.get("hub.challenge", "")
    if not verify_token:
        return "Webhook verification is not configured.", 503
    if mode == "subscribe" and challenge and hmac.compare_digest(
            supplied_token.encode("utf-8"), verify_token.encode("utf-8")):
        return challenge, 200, {"Content-Type": "text/plain; charset=utf-8"}
    return "Forbidden", 403


@app.post("/webhook")
def receive_whatsapp_webhook():
    """Verify and record incoming WhatsApp messages; ignore status-only events."""
    raw_body = request.get_data(cache=True)
    if not os.getenv("META_APP_SECRET"):
        return jsonify({"error": "Webhook signature verification is not configured."}), 503
    if not verify_webhook_signature(raw_body, request.headers.get("X-Hub-Signature-256"),
                                    os.environ["META_APP_SECRET"]):
        return jsonify({"error": "Invalid webhook signature."}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON payload."}), 400
    try:
        received_count = 0
        for message in extract_incoming_messages(payload):
            if save_incoming_message(**message):
                received_count += 1
    except INCOMING_MESSAGE_ERRORS:
        app.logger.exception("Could not store incoming WhatsApp message")
        return jsonify({"error": "Message could not be processed."}), 500
    return jsonify({"status": "received", "new_messages": received_count}), 200


@app.get("/api/whatsapp/messages")
@staff_api_required
def list_whatsapp_messages():
    """Inspect locally stored inbound messages during development."""
    try:
        return jsonify({"messages": get_incoming_messages()})
    except DATABASE_ERRORS:
        app.logger.exception("Could not retrieve WhatsApp messages")
        return jsonify({"error": "Messages could not be loaded. Please try again."}), 500


with app.app_context():
    initialize_database(app.config["DATABASE_URL"] or app.config["DATABASE_PATH"])


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
