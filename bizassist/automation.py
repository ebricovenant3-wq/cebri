"""Rule-based answers using business information approved by the owner."""


def answer_common_question(message, business_info):
    """Return an approved FAQ answer, or None when a staff member should reply.

    ``business_info`` is a mapping containing approved values such as ``hours``,
    ``location``, ``services`` and ``price_notes``. This deliberately avoids
    inventing prices or business policies.
    """
    text = message.casefold()
    topics = {
        "hours": ("hours", "open", "close", "opening time"),
        "location": ("location", "address", "where are you", "directions"),
        "services": ("service", "what do you do", "offer", "help with"),
        "price_notes": ("price", "cost", "how much", "pricing", "quote"),
    }
    for key, phrases in topics.items():
        if any(phrase in text for phrase in phrases):
            answer = business_info.get(key)
            return answer if answer else None
    return None


def needs_human_handover(message, business_info):
    """Mark messages for staff when an approved automatic answer is unavailable."""
    return answer_common_question(message, business_info) is None
