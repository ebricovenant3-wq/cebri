"""Send a single WhatsApp test message with configured Cloud API credentials."""

import argparse

from whatsapp import send_text_message


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipient", help="Allowed test recipient in international phone format")
    parser.add_argument("message", help="Text message to send")
    args = parser.parse_args()

    result = send_text_message(args.recipient, args.message)
    print("WhatsApp message request accepted.")
    print("Message ID:", result.get("messages", [{}])[0].get("id", "not returned"))


if __name__ == "__main__":
    main()
