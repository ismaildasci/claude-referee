def diff_lines(a, b):
    n, m = len(a), len(b)
    lcs = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            lcs[i][j] = lcs[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(lcs[i - 1][j], lcs[i][j - 1])
    out = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and a[i - 1] == b[j - 1]:
            out.append(("=", a[i - 1]))
            i -= 1
            j -= 1
        elif j > 0 and (i == 0 or lcs[i][j - 1] >= lcs[i - 1][j]):
            out.append(("+", b[j - 1]))
            j -= 1
        else:
            out.append(("-", a[i - 1]))
            i -= 1
    out.reverse()
    return out
