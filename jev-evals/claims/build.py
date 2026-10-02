# Builds the claim-calibration cases from committed docs at HEAD: ~30 hand-labelled claims, each with its source excerpt.
import json, subprocess, re

def lines(path, a, b):
    t = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True, text=True, check=True).stdout.split("\n")
    return "\n".join(t[a - 1:b])

def section(path, start, end):
    t = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True, text=True, check=True).stdout
    i = t.index(start); j = t.index(end, i)
    return t[i:j].strip()

E = {
    "readme_table": ("README.md", lines("README.md", 36, 43)),
    "readme_measured": ("README.md", lines("README.md", 104, 113)),
    "order": ("docs/measurements.md", lines("docs/measurements.md", 7, 22)),
    "gate_modes": ("docs/configuration.md", lines("docs/configuration.md", 55, 63)),
    "privacy_sent": ("docs/privacy.md", lines("docs/privacy.md", 9, 16)),
    "core_limits": ("plugins/claude-referee/skills/jev/references/core.md", lines("plugins/claude-referee/skills/jev/references/core.md", 14, 24)),
    "injection": ("docs/measurements.md", section("docs/measurements.md", "## Instructions inside the evidence", "## Not measured yet")),
}

C = [
    ("c01", "In v0.1, a session start gives Claude a short note of at most 800 characters.", True, "readme_table", True),
    ("c02", "The Stop-hook done-gate ships in v0.1.", False, "readme_table", True),
    ("c03", "When a check finds something, Claude sees a note of at most 800 characters.", False, "readme_table", True),
    ("c04", "The warning before a model switch is planned for v0.2.", True, "readme_table", True),
    ("c05", "In active mode, the done-gate can block a stop any number of times in a session.", False, "readme_table", True),
    ("c06", "Asking in two option orders found the same leader as all 24 orders in 20 of 20 decisions.", True, "readme_measured", True),
    ("c07", "Asking the same request again moved Jev's answer by up to 0.52.", False, "readme_measured", True),
    ("c08", "The Claude turn around a Jev decision cost about $0.10 (estimated), against about $0.0007 for the Jev decision.", True, "readme_measured", True),
    ("c09", "The voluntary done command ran 14 times in one day.", False, "readme_measured", True),
    ("c10", "A second run of the same audit made 10 Jev requests.", False, "readme_measured", True),
    ("c11", "Position bias was small: 0.02 per slot on average.", True, "order", True),
    ("c12", "The written order alone matched the all-orders leader in 20 of 20 decisions.", False, "order", True),
    ("c13", "Four rotations matched the all-orders leader in 19 of 20 decisions.", True, "order", True),
    ("c14", "The order comparison was made against a known right answer.", False, "order", True),
    ("c15", "In shadow mode the done-gate asks Jev and writes a receipt but never blocks.", True, "gate_modes", True),
    ("c16", "Active mode is recommended once shadow mode has 20 labelled stops.", False, "gate_modes", True),
    ("c17", "In active mode the done-gate waits 60 seconds between blocks.", True, "gate_modes", True),
    ("c18", "decide sends the contents of your context_files.", True, "privacy_sent", True),
    ("c19", "In v0.1, done sends only the parsed failures from your test runner.", False, "privacy_sent", True),
    ("c20", "The done-gate sends the full text of Claude's final message.", False, "privacy_sent", True),
    ("c21", "Jev costs $0.042 per million input tokens, and output tokens are free.", True, "core_limits", True),
    ("c22", "A single request can carry up to 128K tokens.", False, "core_limits", True),
    ("c23", "The rate limit is 250K tokens per second.", False, "core_limits", True),
    ("c24", "An unknown model name got a 400 in a live call on 2026-10-01.", True, "core_limits", True),
    ("c25", "When the log showed the failure and the exit code, the note to the judge didn't change a verdict.", True, "injection", True),
    ("c26", "The fake all-passed summary flipped every run to met.", False, "injection", True),
    ("c27", "A pytest log cut off before its summary went from met to missing when the note was added.", False, "injection", True),
    ("c28", "Jev costs $0.042 per million input tokens.", True, "gate_modes", False),
    ("c29", "Asking in two option orders found the same leader as all 24 orders in 20 of 20 decisions.", True, "core_limits", False),
    ("c30", "In shadow mode the done-gate never blocks a stop.", True, "readme_measured", False),
    ("c31", "decide sends the contents of your context_files.", True, "order", False),
]
OPTS = [{"name": "supports", "text": "The source states the claim or directly implies it."},
        {"name": "contradicts", "text": "The source says something that conflicts with the claim."},
        {"name": "says_nothing", "text": "The source doesn't address the claim."}]
with open("jev-evals/claims/cases.jsonl", "w") as f:
    for cid, claim, label, ex, covers in C:
        path, text = E[ex]
        assert len(text) <= 4000, (cid, len(text))
        f.write(json.dumps({"id": cid, "claim": claim, "label": label, "excerpt_covers": covers, "source_files": [path], "excerpt": text}) + "\n")
        json.dump({"decision": f"What is the relation between the source in the context and this claim: {claim}", "context": text, "options": OPTS},
                  open(f"jev-evals/claims/in/{cid}.json", "w"))
print(len(C), "cases;", sum(1 for c in C if c[2] and c[4]), "true covered;", sum(1 for c in C if not c[2]), "false;", sum(1 for c in C if not c[4]), "uncovered")
