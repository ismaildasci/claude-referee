def low_stock(stock, threshold):
    return sorted(sku for sku, n in stock.on_hand.items() if n <= threshold)
