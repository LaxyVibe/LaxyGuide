export function getNextNumericId(usedIds: Iterable<string>): string {
    const used = new Set(Array.from(usedIds, (id) => String(id).trim()).filter(Boolean));

    for (let i = 1; i <= 999999; i++) {
        const candidate = String(i).padStart(3, '0');
        if (!used.has(candidate)) return candidate;
    }

    return String(Date.now());
}
