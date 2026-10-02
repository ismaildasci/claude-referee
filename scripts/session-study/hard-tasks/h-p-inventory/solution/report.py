def low_stock(stock, threshold):
    rows = [(stock.available(sku), sku) for sku in stock.on_hand if stock.available(sku) < threshold]
    return [sku for _, sku in sorted(rows)]


def levels(stock):
    return [(sku, stock.on_hand[sku], stock.reserved.get(sku, 0), stock.available(sku)) for sku in sorted(stock.on_hand)]
