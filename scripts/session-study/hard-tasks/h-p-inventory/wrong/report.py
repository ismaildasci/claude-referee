def low_stock(stock, threshold):
    return sorted(sku for sku, n in stock.on_hand.items() if n <= threshold)


def levels(stock):
    return [(sku, stock.on_hand[sku], stock.reserved.get(sku, 0), stock.available(sku)) for sku in sorted(stock.on_hand)]
