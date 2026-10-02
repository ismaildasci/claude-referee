const WIDE = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

function charWidth(cp) {
  if (cp >= 0x300 && cp <= 0x36f) return 0;
  return WIDE.some(([a, b]) => cp >= a && cp <= b) ? 2 : 1;
}

const widthOf = (text) => [...text].reduce((sum, ch) => sum + charWidth(ch.codePointAt(0)), 0);

function clusters(word) {
  const out = [];
  for (const ch of word) {
    if (out.length && charWidth(ch.codePointAt(0)) === 0) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

function split(word, width) {
  const pieces = [];
  let cur = "";
  for (const c of clusters(word)) {
    if (cur && widthOf(cur) + widthOf(c) > width) {
      pieces.push(cur);
      cur = "";
    }
    cur += c;
  }
  if (cur) pieces.push(cur);
  return pieces;
}

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
      if (line && widthOf(line) + 1 + widthOf(word) <= width) {
        line += " " + word;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (widthOf(word) <= width) line = word;
      else {
        const pieces = split(word, width);
        line = pieces.pop();
        lines.push(...pieces);
      }
    }
    lines.push(line);
  }
  return lines;
}
