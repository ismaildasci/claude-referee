# bump

`bump(version, part, preid=None)` in `versions.py` returns the next version as a string, following the rules of `npm version`.

A version is `MAJOR.MINOR.PATCH` with an optional `-PRERELEASE` of dot separated identifiers made of `[0-9A-Za-z-]`; build metadata (`+...`) is not accepted. A malformed version, an unknown `part`, or a `preid` (when given) that is empty or contains anything but `[0-9A-Za-z-]` raises a ValueError.

Parts:

- `major`: when the version has a prerelease and its minor and patch are both 0, the result is the same version without the prerelease (`2.0.0-rc.1` becomes `2.0.0`); otherwise major goes up by one, minor and patch become 0 and the prerelease is dropped
- `minor`: when the version has a prerelease and its patch is 0, the prerelease is simply dropped (`1.3.0-rc.1` becomes `1.3.0`); otherwise minor goes up by one, patch becomes 0 and the prerelease is dropped
- `patch`: when the version has a prerelease, it is simply dropped (`1.2.4-rc.1` becomes `1.2.4`); otherwise patch goes up by one
- `premajor`, `preminor`, `prepatch`: the prerelease is dropped, major (minor, patch) goes up by one as in a plain bump (the lower numbers become 0), and the prerelease is `preid.0`, or just `0` when there is no `preid`
- `prerelease`:
  - on a version without a prerelease: patch goes up by one and the prerelease is `preid.0` (`0` without `preid`)
  - on a version with a prerelease: when `preid` is given and differs from the first identifier of the prerelease, the prerelease becomes `preid.0`; otherwise the last numeric identifier of the prerelease goes up by one, and when there is none `.0` is appended (`1.2.3-beta` becomes `1.2.3-beta.0`, `1.2.3-beta.1` becomes `1.2.3-beta.2`, `1.2.3-0` becomes `1.2.3-1`)
- `preid` is ignored by `major`, `minor` and `patch`
