import csv

HEADER = ["name", "qty", "price", "date"]


def parse_lines(text):
    lines = text.split("\n")
    first = lines[0][:-1] if lines[0].endswith("\r") else lines[0]
    if [f.strip() for f in first.split(",")] != HEADER or first != ",".join(HEADER):
        raise ValueError("bad header")
    rows = []
    for number, raw in enumerate(lines, start=1):
        if number == 1:
            continue
        line = raw[:-1] if raw.endswith("\r") else raw
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            continue
        fields = next(csv.reader([line], skipinitialspace=True))
        rows.append({"line": number, "fields": [f.strip() for f in fields]})
    return rows
