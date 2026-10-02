# inventory with reservations

Three modules today: `stock.py` (`Stock`, `OutOfStock`), `orders.py` (`Orders`) and `report.py` (`low_stock`). Orders currently take stock out of `on_hand` the moment they are placed. The change: stock is reserved when an order is placed, and only leaves when the order ships.

## stock.py

- `Stock(on_hand=None)` keeps `stock.on_hand` (dict of sku to int) and `stock.reserved` (dict of sku to int; a sku whose reservation is 0 is not in the dict)
- `available(sku)` is `on_hand - reserved` (0 for an unknown sku)
- `add(sku, n)` adds `n` to `on_hand`; `n` must be an int of at least 1, otherwise a ValueError
- `reserve(sku, n)` raises `OutOfStock(sku)` when `available(sku) < n`, otherwise raises `reserved` by `n`
- `release(sku, n)` lowers `reserved` by `n`; `ship(sku, n)` lowers both `on_hand` and `reserved` by `n`; both raise a ValueError when `n` is more than is reserved

## orders.py

- `Orders(stock)`; `place(order_id, items)` where `items` maps sku to a quantity of at least 1 (otherwise a ValueError); a repeated `order_id` is a ValueError
- placing an order reserves every item, all or nothing: when some skus are short, `OutOfStock` is raised with the sorted list of all short skus as its only argument and nothing at all is reserved. The order's status is `"placed"`
- `cancel(order_id)` is only allowed for a `"placed"` order: it releases the reservation and the status becomes `"cancelled"`; any other status is a ValueError and an unknown id is a KeyError
- `ship(order_id)` is only allowed for a `"placed"` order (same errors): it ships every item and the status becomes `"shipped"`
- `status(order_id)` returns the status

## report.py

- `low_stock(stock, threshold)` lists the skus whose available quantity is strictly below `threshold`, sorted by available quantity and then by sku
- `levels(stock)` returns a list of `(sku, on_hand, reserved, available)` tuples sorted by sku, one per sku in `on_hand`
