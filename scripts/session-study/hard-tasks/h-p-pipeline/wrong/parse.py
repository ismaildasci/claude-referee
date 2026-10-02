HEADER = "name,qty,price,date"


def parse_lines(text):
    lines = text.splitlines()
    if not lines or lines[0].strip() != HEADER:
        raise ValueError("bad header")
    rows = []
    for number, line in enumerate(lines[1:], start=2):
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            continue
        rows.append({"line": number, "fields": [f.strip().strip('"') for f in line.split(",")]})
    return rows
