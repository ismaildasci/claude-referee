from datetime import date

from months import add_months, months_between, recurring

assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
assert add_months(date(2023, 1, 31), 1) == date(2023, 2, 28)
assert add_months(date(2024, 3, 31), -1) == date(2024, 2, 29)
assert add_months(date(2024, 12, 15), 1) == date(2025, 1, 15)
assert add_months(date(2024, 1, 15), -1) == date(2023, 12, 15)
assert add_months(date(2024, 1, 31), 13) == date(2025, 2, 28)
assert add_months(date(2024, 5, 31), 0) == date(2024, 5, 31)
assert add_months(date(2024, 2, 29), 12) == date(2025, 2, 28)
assert add_months(date(2024, 2, 29), -12) == date(2023, 2, 28)
assert add_months(date(2024, 2, 29), 48) == date(2028, 2, 29)
assert recurring(date(2024, 1, 31), 1, 4) == [date(2024, 1, 31), date(2024, 2, 29), date(2024, 3, 31), date(2024, 4, 30)]
assert recurring(date(2024, 1, 30), 1, 3) == [date(2024, 1, 30), date(2024, 2, 29), date(2024, 3, 30)]
assert recurring(date(2024, 2, 29), 12, 5) == [date(2024, 2, 29), date(2025, 2, 28), date(2026, 2, 28), date(2027, 2, 28), date(2028, 2, 29)]
assert recurring(date(2024, 5, 15), 3, 0) == []
for step, count in [(0, 3), (-1, 3), (1, -1), (1.5, 2), (1, 2.0)]:
    try:
        recurring(date(2024, 1, 1), step, count)
    except ValueError:
        pass
    else:
        raise AssertionError((step, count))
assert months_between(date(2023, 1, 31), date(2023, 2, 28)) == 1
assert months_between(date(2023, 1, 31), date(2023, 2, 27)) == 0
assert months_between(date(2023, 1, 15), date(2023, 3, 14)) == 1
assert months_between(date(2023, 1, 15), date(2023, 3, 15)) == 2
assert months_between(date(2023, 3, 15), date(2023, 1, 15)) == -2
assert months_between(date(2023, 2, 28), date(2023, 1, 31)) == -1
assert months_between(date(2024, 2, 29), date(2025, 2, 28)) == 12
assert months_between(date(2024, 5, 10), date(2024, 5, 10)) == 0
assert months_between(date(2023, 12, 31), date(2024, 2, 29)) == 2
assert months_between(date(2023, 12, 31), date(2024, 2, 28)) == 1
