// Rainbow colors for character names (round-robin)
export const RAINBOW_COLORS = [
    '#FF0000', // Red
    '#FF7F00', // Orange
    '#FFFF00', // Yellow
    '#00FF00', // Green
    '#0000FF', // Blue
    '#4B0082', // Indigo
    '#9400D3', // Violet
];

// Map to track assigned colors per character name
const nameColorMap = new Map<string, string>();
let colorIndex = 0;

/**
 * Get a consistent color for a character name (assigns on first use)
 */
export function getNameColor(name: string): string {
    if (!nameColorMap.has(name)) {
        nameColorMap.set(name, RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length]);
        colorIndex++;
    }
    return nameColorMap.get(name)!;
}

/**
 * Wrap a name with color markup: [[color:NAME]]
 */
export function colorName(name: string): string {
    const color = getNameColor(name);
    return `[[${color}:${name}]]`;
}

/**
 * Reset color assignments (for new games)
 */
export function resetNameColors(): void {
    nameColorMap.clear();
    colorIndex = 0;
}
