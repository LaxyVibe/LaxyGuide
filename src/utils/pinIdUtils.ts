export function indexToLetters(index: number): string {
    // 0 -> A, 25 -> Z, 26 -> AA
    if (!Number.isFinite(index) || index < 0) return 'A';

    let n = Math.floor(index);
    let out = '';
    while (n >= 0) {
        const rem = n % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor(n / 26) - 1;
    }
    return out;
}

export function getNextLetterId(usedIds: Iterable<string>): string {
    const used = new Set(Array.from(usedIds));
    for (let i = 0; i < 26 * 26 * 26; i++) {
        const candidate = indexToLetters(i);
        if (!used.has(candidate)) return candidate;
    }
    // Fallback (should never happen in practice)
    return `P${Date.now()}`;
}

export function maybeMigrateNumericIdToLetters(id: unknown, usedIds: Set<string>): string | null {
    if (typeof id !== 'string') return null;
    const trimmed = id.trim();
    if (!/^\d+$/.test(trimmed)) return null;

    const asNum = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(asNum) || asNum <= 0) return null;

    const letters = indexToLetters(asNum - 1);
    if (usedIds.has(letters)) return null;

    usedIds.add(letters);
    return letters;
}
