from orders import Orders
from report import levels, low_stock
from stock import OutOfStock, Stock


def raises(exc, fn, *args):
    try:
        fn(*args)
    except exc as e:
        return e
    raise AssertionError((exc, args))


s = Stock({"a": 10, "b": 3})
assert s.available("a") == 10 and s.available("zzz") == 0
s.add("c", 4)
assert s.on_hand == {"a": 10, "b": 3, "c": 4}
for bad in (0, -1, 1.5, True):
    raises(ValueError, s.add, "a", bad)
s.reserve("a", 4)
assert s.reserved == {"a": 4} and s.available("a") == 6
e = raises(OutOfStock, s.reserve, "a", 7)
assert e.args == ("a",)
assert s.reserved == {"a": 4}
s.release("a", 4)
assert s.reserved == {}
raises(ValueError, s.release, "a", 1)
s.reserve("b", 2)
raises(ValueError, s.ship, "b", 3)
s.ship("b", 2)
assert s.on_hand["b"] == 1 and s.reserved == {}

stock = Stock({"a": 5, "b": 2, "c": 0})
orders = Orders(stock)
orders.place("o1", {"a": 3, "b": 1})
assert orders.status("o1") == "placed"
assert stock.reserved == {"a": 3, "b": 1} and stock.on_hand == {"a": 5, "b": 2, "c": 0}
assert stock.available("a") == 2
e = raises(OutOfStock, orders.place, "o2", {"a": 2, "b": 5, "c": 1, "d": 1})
assert e.args == (["b", "c", "d"],), e.args
assert stock.reserved == {"a": 3, "b": 1}, stock.reserved
assert "o2" not in orders.orders
raises(ValueError, orders.place, "o1", {"a": 1})
raises(ValueError, orders.place, "o3", {"a": 0})
raises(ValueError, orders.place, "o3", {"a": 1.5})
assert stock.reserved == {"a": 3, "b": 1}
orders.cancel("o1")
assert stock.reserved == {} and stock.on_hand == {"a": 5, "b": 2, "c": 0}
assert orders.status("o1") == "cancelled"
raises(ValueError, orders.cancel, "o1")
raises(ValueError, orders.ship, "o1")
raises(KeyError, orders.cancel, "nope")
orders.place("o4", {"a": 5})
orders.ship("o4")
assert orders.status("o4") == "shipped"
assert stock.on_hand["a"] == 0 and stock.reserved == {}
raises(ValueError, orders.cancel, "o4")
raises(ValueError, orders.ship, "o4")

st = Stock({"a": 10, "b": 4, "c": 1, "d": 4})
od = Orders(st)
od.place("x", {"a": 8, "d": 2})
assert low_stock(st, 3) == ["c", "a", "d"], low_stock(st, 3)
assert low_stock(st, 2) == ["c"], low_stock(st, 2)
assert low_stock(st, 1) == []
assert low_stock(st, 5) == ["c", "a", "d", "b"], low_stock(st, 5)
assert levels(st) == [("a", 10, 8, 2), ("b", 4, 0, 4), ("c", 1, 0, 1), ("d", 4, 2, 2)], levels(st)
assert levels(Stock()) == []
