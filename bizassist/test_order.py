import json
from urllib.request import Request, urlopen

url = "http://127.0.0.1:5001/api/orders"

order = {
    "name": "Test Customer",
    "phone": "TEST-001",
    "product": "Office Curtains",
    "quantity": 2,
    "unit_price": 25000,
}

request = Request(
    url,
    data=json.dumps(order).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urlopen(request) as response:
    print("Status:", response.status)
    print(response.read().decode("utf-8"))
