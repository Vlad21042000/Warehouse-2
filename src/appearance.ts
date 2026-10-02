export type Appearance = { theme: 'dark' | 'light'; background: 'warehouse' | 'plain'; dimming: number };
export const APPEARANCE_KEY = 'warehouse-appearance-v1';
export const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', background: 'warehouse', dimming: 60 };
export function readAppearance(value: string | null): Appearance {
  try {
    const parsed = JSON.parse(value ?? '{}');
    return {
      theme: parsed?.theme === 'light' ? 'light' : 'dark',
      background: parsed?.background === 'plain' ? 'plain' : 'warehouse',
      dimming: typeof parsed?.dimming === 'number' && Number.isFinite(parsed.dimming) ? Math.min(90, Math.max(20, parsed.dimming)) : 60,
    };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
