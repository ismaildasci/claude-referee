from parse import parse_lines
from report import summarize
from validate import validate


def run(text):
    valid, errors = validate(parse_lines(text))
    return summarize(valid, errors)
