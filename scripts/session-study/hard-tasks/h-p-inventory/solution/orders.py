from stock import OutOfStock


class Orders:
    def __init__(self, stock):
        self.stock = stock
        self.orders = {}

    def place(self, order_id, items):
        if order_id in self.orders:
            raise ValueError("duplicate order")
        for qty in items.values():
            if isinstance(qty, bool) or not isinstance(qty, int) or qty < 1:
                raise ValueError("bad quantity")
        short = sorted(sku for sku, qty in items.items() if self.stock.available(sku) < qty)
        if short:
            raise OutOfStock(short)
        for sku, qty in items.items():
            self.stock.reserve(sku, qty)
        self.orders[order_id] = {"items": dict(items), "status": "placed"}

    def _placed(self, order_id):
        order = self.orders[order_id]
        if order["status"] != "placed":
            raise ValueError(f"order is {order['status']}")
        return order

    def cancel(self, order_id):
        order = self._placed(order_id)
        for sku, qty in order["items"].items():
            self.stock.release(sku, qty)
        order["status"] = "cancelled"

    def ship(self, order_id):
        order = self._placed(order_id)
        for sku, qty in order["items"].items():
            self.stock.ship(sku, qty)
        order["status"] = "shipped"

    def status(self, order_id):
        return self.orders[order_id]["status"]
