// Institute brand colour → CSS variables, with text colour chosen for WCAG contrast (white or ink, whichever wins).
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const INK = '#141413';

export function brandStyle(color: string | undefined) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const l = lum(color);
  const onAccent = (l + 0.05) / (lum(INK) + 0.05) >= 1.05 / (l + 0.05) ? INK : '#ffffff';
  return { '--accent': color, '--on-accent': onAccent } as React.CSSProperties;
}
