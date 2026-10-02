export function wrapText(text, width) {
  if (!Number.isInteger(width) || width < 2) throw new RangeError("width must be an integer of at least 2");
  const lines = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ").filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (line && line.length + 1 + word.length <= width) {
        line += " " + word;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      let rest = word;
      while (rest.length > width) {
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}
