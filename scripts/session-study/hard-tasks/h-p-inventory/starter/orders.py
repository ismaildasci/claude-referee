from stock import OutOfStock


class Orders:
    def __init__(self, stock):
        self.stock = stock
        self.orders = {}

    def place(self, order_id, items):
        for sku, qty in items.items():
            if self.stock.available(sku) < qty:
                raise OutOfStock(sku)
            self.stock.on_hand[sku] -= qty
        self.orders[order_id] = {"items": dict(items), "status": "placed"}

    def cancel(self, order_id):
        order = self.orders[order_id]
        for sku, qty in order["items"].items():
            self.stock.add(sku, qty)
        order["status"] = "cancelled"
