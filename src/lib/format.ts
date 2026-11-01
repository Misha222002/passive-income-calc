const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 2,
  minimumFractionDigits: 1,
});

export function formatRub(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return rubFormatter.format(Math.round(value));
}

export function formatRubCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1) return "0 ₽";
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toLocaleString("ru-RU", {
      maximumFractionDigits: millions >= 100 ? 0 : 1,
    })} млн ₽`;
  }
  return rubFormatter.format(Math.round(value));
}

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercentPoints(value: number): string {
  return percentFormatter.format(value);
}

export function yearsRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${n} лет`;
  if (last === 1) return `${n} год`;
  if (last >= 2 && last <= 4) return `${n} года`;
  return `${n} лет`;
}

export function banksRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${n} банков`;
  if (last === 1) return `${n} банк`;
  if (last >= 2 && last <= 4) return `${n} банка`;
  return `${n} банков`;
}
