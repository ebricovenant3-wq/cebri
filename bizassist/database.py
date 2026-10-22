"""Persistence helpers for BizAssist using SQLite locally or PostgreSQL on Render."""

import math
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # PostgreSQL support is only needed when DATABASE_URL is set.
    psycopg = None
    dict_row = None

load_dotenv(Path(__file__).resolve().parent / ".env")

_configured_url = os.getenv("DATABASE_URL", "").strip()
if _configured_url:
    DB_NAME = _configured_url
else:
    _configured_path = Path(os.getenv("DATABASE_PATH", "bizassist.sqlite3"))
    DB_NAME = (_configured_path if _configured_path.is_absolute()
               else Path(__file__).resolve().parent / _configured_path)

DATABASE_ERRORS = (sqlite3.Error,) + ((psycopg.Error,) if psycopg else ())
INCOMING_MESSAGE_ERRORS = DATABASE_ERRORS + (ValueError,)


def _is_postgres(database_target):
    return isinstance(database_target, str) and database_target.startswith(
        ("postgres://", "postgresql://")
    )


class _PostgresConnection:
    """Adapt the project's small SQLite-style execute interface to psycopg."""

    def __init__(self, database_url):
        if psycopg is None:
            raise RuntimeError("Install psycopg to use a PostgreSQL DATABASE_URL.")
        self.connection = psycopg.connect(database_url, row_factory=dict_row)

    def __enter__(self):
        self.connection.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.connection.__exit__(exc_type, exc_value, traceback)

    def execute(self, statement, parameters=()):
        return self.connection.execute(statement.replace("?", "%s"), parameters)


def get_connection(database_target=DB_NAME):
    """Open a connection and enable SQLite foreign keys where applicable."""
    if _is_postgres(database_target):
        return _PostgresConnection(database_target)

    path = Path(database_target)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _initialize_postgres(database_url):
    with get_connection(database_url) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT UNIQUE,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enquiries (
                id BIGSERIAL PRIMARY KEY,
                customer_id BIGINT NOT NULL REFERENCES customers(id),
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                provider_message_id TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id BIGSERIAL PRIMARY KEY,
                customer_id BIGINT NOT NULL REFERENCES customers(id),
                product TEXT NOT NULL DEFAULT 'Unspecified',
                quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
                unit_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
                total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Preserve data created by the original SQLite schema when a compatible
        # Postgres database is upgraded in the future.
        additions = {
            "product": "TEXT NOT NULL DEFAULT 'Unspecified'",
            "quantity": "INTEGER NOT NULL DEFAULT 1",
            "unit_price": "DOUBLE PRECISION NOT NULL DEFAULT 0",
            "total_amount": "DOUBLE PRECISION NOT NULL DEFAULT 0",
            "currency": "TEXT NOT NULL DEFAULT 'USD'",
        }
        for name, definition in additions.items():
            conn.execute(f"ALTER TABLE orders ADD COLUMN IF NOT EXISTS {name} {definition}")
        conn.execute("ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS provider_message_id TEXT")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS enquiries_provider_message_id_idx "
                     "ON enquiries(provider_message_id)")


def initialize_database(database_target=DB_NAME):
    """Create tables and add compatible order fields without dropping data."""
    if _is_postgres(database_target):
        _initialize_postgres(database_target)
        return

    with get_connection(database_target) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                provider_message_id TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                product TEXT NOT NULL DEFAULT 'Unspecified',
                quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
                unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
                total_amount REAL NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        """)

        # Keep databases created by the earlier scaffold usable without deleting data.
        order_columns = {row["name"] for row in conn.execute("PRAGMA table_info(orders)")}
        additions = {
            "product": "TEXT NOT NULL DEFAULT 'Unspecified'",
            "quantity": "INTEGER NOT NULL DEFAULT 1",
            "unit_price": "REAL NOT NULL DEFAULT 0",
            "total_amount": "REAL NOT NULL DEFAULT 0",
            "currency": "TEXT NOT NULL DEFAULT 'USD'",
        }
        for name, definition in additions.items():
            if name not in order_columns:
                conn.execute(f"ALTER TABLE orders ADD COLUMN {name} {definition}")

        enquiry_columns = {row["name"] for row in conn.execute("PRAGMA table_info(enquiries)")}
        if "provider_message_id" not in enquiry_columns:
            conn.execute("ALTER TABLE enquiries ADD COLUMN provider_message_id TEXT")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS enquiries_provider_message_id_idx "
                         "ON enquiries(provider_message_id)")


def init_db(database_target=DB_NAME):
    """Compatibility wrapper for the Flask app's original initialization call."""
    initialize_database(database_target)


def _clean_required(value, field, max_length):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} is required.")
    result = value.strip()
    if len(result) > max_length:
        raise ValueError(f"{field} must be {max_length} characters or fewer.")
    return result


def save_customer(name, phone):
    """Create or update a customer by phone number; return the customer ID."""
    name = _clean_required(name, "Name", 120)
    phone = _clean_required(phone, "Phone", 40)
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO customers (name, phone)
            VALUES (?, ?)
            ON CONFLICT(phone) DO UPDATE SET name = excluded.name
        """, (name, phone))
        row = conn.execute("SELECT id FROM customers WHERE phone = ?", (phone,)).fetchone()
        return row["id"]


def save_order(name, phone, product, quantity, unit_price, currency="NGN"):
    """Save a validated single-product order and return its new ID."""
    name = _clean_required(name, "Name", 120)
    phone = _clean_required(phone, "Phone", 40)
    product = _clean_required(product, "Product", 160)
    currency = _clean_required(currency, "Currency", 3).upper()
    if len(currency) != 3 or not currency.isalpha():
        raise ValueError("Currency must be a three-letter code.")
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
        raise ValueError("Quantity must be a positive whole number.")
    if isinstance(unit_price, bool) or not isinstance(unit_price, (int, float)):
        raise ValueError("Unit price must be a non-negative number.")
    unit_price = float(unit_price)
    if not math.isfinite(unit_price) or unit_price < 0:
        raise ValueError("Unit price must be a finite, non-negative number.")

    with get_connection() as conn:
        conn.execute("""
            INSERT INTO customers (name, phone)
            VALUES (?, ?)
            ON CONFLICT(phone) DO UPDATE SET name = excluded.name
        """, (name, phone))
        customer = conn.execute("SELECT id FROM customers WHERE phone = ?", (phone,)).fetchone()
        insert_sql = """
            INSERT INTO orders (customer_id, product, quantity, unit_price, total_amount, currency)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        if _is_postgres(DB_NAME):
            row = conn.execute(insert_sql + " RETURNING id", (
                customer["id"], product, quantity, unit_price, quantity * unit_price, currency
            )).fetchone()
            return row["id"]
        cursor = conn.execute(insert_sql, (
            customer["id"], product, quantity, unit_price, quantity * unit_price, currency
        ))
        return cursor.lastrowid


def get_orders():
    """Return orders with their customer details, newest first."""
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT orders.id, customers.name, customers.phone, orders.product,
                   orders.quantity, orders.unit_price, orders.total_amount,
                   orders.currency, orders.status, orders.created_at
            FROM orders
            JOIN customers ON customers.id = orders.customer_id
            ORDER BY orders.id DESC
        """).fetchall()
        return [dict(row) for row in rows]


def save_incoming_message(phone, name, message, message_id):
    """Record one inbound WhatsApp message and deduplicate Meta retries."""
    phone = _clean_required(phone, "Phone", 40)
    name = _clean_required(name or phone, "Name", 120)
    message = _clean_required(message, "Message", 4000)
    message_id = _clean_required(message_id, "Message ID", 200)
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO customers (name, phone)
            VALUES (?, ?)
            ON CONFLICT(phone) DO UPDATE SET name = excluded.name
        """, (name, phone))
        customer = conn.execute("SELECT id FROM customers WHERE phone = ?", (phone,)).fetchone()
        if _is_postgres(DB_NAME):
            cursor = conn.execute("""
                INSERT INTO enquiries (customer_id, message, provider_message_id)
                VALUES (?, ?, ?)
                ON CONFLICT(provider_message_id) DO NOTHING
            """, (customer["id"], message, message_id))
        else:
            cursor = conn.execute("""
                INSERT OR IGNORE INTO enquiries (customer_id, message, provider_message_id)
                VALUES (?, ?, ?)
            """, (customer["id"], message, message_id))
        return cursor.rowcount == 1


def get_incoming_messages(limit=100):
    """Return recent inbound messages for local development and debugging."""
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 500:
        raise ValueError("Limit must be between 1 and 500.")
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT enquiries.id, customers.name, customers.phone, enquiries.message,
                   enquiries.status, enquiries.created_at
            FROM enquiries
            JOIN customers ON customers.id = enquiries.customer_id
            ORDER BY enquiries.id DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [dict(row) for row in rows]
