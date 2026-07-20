export function compactNumber(value: string | number, prefix = ""): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${prefix}0`;
  return `${prefix}${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(parsed)}`;
}

export function formatPrice(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return "$0";
  if (parsed < 0.0001) return `$${parsed.toExponential(2)}`;
  return `$${parsed.toLocaleString("en", { maximumFractionDigits: 6 })}`;
}

export function formatAddress(address: string): string {
  return address.length < 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTokenAmount(value: string, decimals = 18): string {
  const raw = Number(value) / 10 ** decimals;
  return compactNumber(Number.isFinite(raw) ? raw : 0);
}
