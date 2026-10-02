from datetime import date, datetime, timezone

from nightshift import night_minutes

U = timezone.utc


def at(*args):
    return datetime(*args, tzinfo=U)


assert night_minutes(at(2024, 1, 10, 23), at(2024, 1, 11, 3), "Europe/Berlin") == 240
assert night_minutes(at(2024, 1, 10, 23), at(2024, 1, 11, 3), "Europe/Berlin", skip=[date(2024, 1, 10)]) == 0
assert night_minutes(at(2024, 1, 10, 23), at(2024, 1, 11, 3), "Europe/Berlin", skip={date(2024, 1, 11)}) == 240
assert night_minutes(at(2024, 1, 1, 0), at(2024, 1, 8, 0), "Europe/Berlin") == 300 + 6 * 480 + 180
assert night_minutes(at(2024, 3, 30, 12), at(2024, 4, 1, 12), "Europe/Berlin") == 420 + 480
assert night_minutes(at(2024, 10, 26, 12), at(2024, 10, 28, 12), "Europe/Berlin") == 540 + 480
assert night_minutes(at(2024, 3, 9, 12), at(2024, 3, 11, 12), "America/New_York") == 420 + 480
assert night_minutes(at(2024, 11, 2, 12), at(2024, 11, 4, 12), "America/New_York") == 540 + 480
assert night_minutes(at(2024, 3, 9, 12), at(2024, 3, 11, 12), "America/New_York", skip=[date(2024, 3, 9)]) == 480
assert night_minutes(at(2024, 6, 1, 12), at(2024, 6, 1, 12), "Asia/Kolkata") == 0
assert night_minutes(at(2024, 6, 1, 12), at(2024, 6, 1, 15), "Asia/Kolkata") == 0
assert night_minutes(at(2024, 6, 1, 16, 30), at(2024, 6, 1, 17, 30), "Asia/Kolkata") == 60
from zoneinfo import ZoneInfo
berlin = ZoneInfo("Europe/Berlin")
assert night_minutes(datetime(2024, 3, 30, 22, 0, tzinfo=berlin), datetime(2024, 3, 31, 6, 0, tzinfo=berlin), "Europe/Berlin") == 420
assert night_minutes(datetime(2024, 10, 26, 22, 0, tzinfo=berlin), datetime(2024, 10, 27, 6, 0, tzinfo=berlin), "Europe/Berlin") == 540
assert night_minutes(datetime(2024, 1, 11, 0, 0, tzinfo=berlin), datetime(2024, 1, 11, 4, 0, tzinfo=berlin), "Europe/Berlin") == 240
for bad in [
    (datetime(2024, 1, 1, 0, 0), at(2024, 1, 2)),
    (at(2024, 1, 2), at(2024, 1, 1)),
    (at(2024, 1, 1, 0, 0, 30), at(2024, 1, 2)),
]:
    try:
        night_minutes(bad[0], bad[1], "UTC")
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
