class OutOfStock(Exception):
    pass


class Stock:
    def __init__(self, on_hand=None):
        self.on_hand = dict(on_hand or {})

    def add(self, sku, n):
        self.on_hand[sku] = self.on_hand.get(sku, 0) + n

    def available(self, sku):
        return self.on_hand.get(sku, 0)
