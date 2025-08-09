export function darkenColor(
  hexColor?: string,
  amount?: number,
): string | undefined {
  if (!hexColor || !amount) return;

  // Remove o "#" caso exista
  hexColor = hexColor.replace('#', '');

  // Converte HEX para RGB
  let r = parseInt(hexColor.slice(0, 2), 16);
  let g = parseInt(hexColor.slice(2, 4), 16);
  let b = parseInt(hexColor.slice(4, 6), 16);

  // Aplica o fator de escurecimento
  r = Math.max(0, Math.min(255, r - r * amount));
  g = Math.max(0, Math.min(255, g - g * amount));
  b = Math.max(0, Math.min(255, b - b * amount));

  // Converte RGB de volta para HEX
  const toHex = (x: number): string => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
