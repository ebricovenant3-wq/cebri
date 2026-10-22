"""Flask entry point for the BizAssist dashboard."""

import os
import hmac
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from database import (
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
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "local-development-only")
app.config["WEBHOOK_ONLY_MODE"] = os.getenv("WEBHOOK_ONLY_MODE", "false").lower() == "true"
database_path = Path(os.getenv("DATABASE_PATH", "bizassist.sqlite3"))
app.config["DATABASE_PATH"] = str(database_path if database_path.is_absolute() else BASE_DIR / database_path)


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
def dashboard():
    return render_template("dashboard.html")


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}

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
    except sqlite3.Error:
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
def list_orders():
    try:
        return jsonify({"orders": get_orders()})
    except sqlite3.Error:
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
    except (sqlite3.Error, ValueError):
        app.logger.exception("Could not store incoming WhatsApp message")
        return jsonify({"error": "Message could not be processed."}), 500
    return jsonify({"status": "received", "new_messages": received_count}), 200


@app.get("/api/whatsapp/messages")
def list_whatsapp_messages():
    """Inspect locally stored inbound messages during development."""
    try:
        return jsonify({"messages": get_incoming_messages()})
    except sqlite3.Error:
        app.logger.exception("Could not retrieve WhatsApp messages")
        return jsonify({"error": "Messages could not be loaded. Please try again."}), 500


with app.app_context():
    initialize_database(app.config["DATABASE_PATH"])


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
