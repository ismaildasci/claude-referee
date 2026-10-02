def diff_lines(a, b):
    ka = [line.rstrip(" \t") for line in a]
    kb = [line.rstrip(" \t") for line in b]
    n, m = len(a), len(b)
    lcs = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            lcs[i][j] = lcs[i + 1][j + 1] + 1 if ka[i] == kb[j] else max(lcs[i + 1][j], lcs[i][j + 1])
    out = []
    i = j = 0
    while i < n or j < m:
        if i < n and j < m and ka[i] == kb[j]:
            out.append(("=", a[i]))
            i += 1
            j += 1
        elif i >= n:
            out.append(("+", b[j]))
            j += 1
        elif j >= m:
            out.append(("-", a[i]))
            i += 1
        elif lcs[i + 1][j] >= lcs[i][j + 1]:
            out.append(("-", a[i]))
            i += 1
        else:
            out.append(("+", b[j]))
            j += 1
    return out
