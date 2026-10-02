class OutOfStock(Exception):
    pass


class Stock:
    def __init__(self, on_hand=None):
        self.on_hand = dict(on_hand or {})
        self.reserved = {}

    def available(self, sku):
        return self.on_hand.get(sku, 0) - self.reserved.get(sku, 0)

    def add(self, sku, n):
        if isinstance(n, bool) or not isinstance(n, int) or n < 1:
            raise ValueError("n must be an int of at least 1")
        self.on_hand[sku] = self.on_hand.get(sku, 0) + n

    def reserve(self, sku, n):
        if self.available(sku) < n:
            raise OutOfStock(sku)
        self.reserved[sku] = self.reserved.get(sku, 0) + n

    def _lower(self, sku, n):
        held = self.reserved.get(sku, 0)
        if n > held:
            raise ValueError("more than reserved")
        if held - n == 0:
            self.reserved.pop(sku, None)
        else:
            self.reserved[sku] = held - n

    def release(self, sku, n):
        self._lower(sku, n)

    def ship(self, sku, n):
        self._lower(sku, n)
        self.on_hand[sku] -= n
