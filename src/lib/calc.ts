/** Налоговые и страховые константы РФ на 2025–2026 гг. */
export const TAX_FREE_BASE = 1_000_000;
export const PIT_THRESHOLD = 2_400_000;
export const PIT_LOW = 0.13;
export const PIT_HIGH = 0.15;
export const DIA_LIMIT = 1_400_000;
export const MAX_SEARCH_YEARS = 80;

export type CapitalNeed = {
  possible: boolean;
  capitalToday: number;
  annualInterest: number;
  annualTax: number;
  netInterest: number;
  inflationReserve: number;
  annualWithdrawal: number;
  netYield: number;
  realSpread: number;
  taxFreeAmount: number;
};

export type YearRow = {
  year: number;
  balance: number;
  needed: number;
  tax: number;
  interest: number;
  contributions: number;
  realBalance: number;
};

export type PaymentGoal = {
  years: number;
  payment: number;
  possible: boolean;
};

export type PlanInputs = {
  monthlyWithdrawal: number;
  monthlySaving: number;
  depositRate: number;
  inflation: number;
  keyRate: number;
  indexContributions: boolean;
  maxYears?: number;
};

export type PlanResult = {
  need: CapitalNeed;
  years: number | null;
  history: YearRow[];
  reached: boolean;
  finalBalance: number;
  finalNeeded: number;
  monthlyToFinish: PaymentGoal[];
  banksForInsurance: number;
};

export function depositTax(interest: number, keyRate: number): number {
  const taxFree = TAX_FREE_BASE * keyRate;
  const taxable = Math.max(0, interest - taxFree);
  if (taxable <= PIT_THRESHOLD) return taxable * PIT_LOW;
  return PIT_THRESHOLD * PIT_LOW + (taxable - PIT_THRESHOLD) * PIT_HIGH;
}

export function netInterest(
  capital: number,
  rate: number,
  keyRate: number,
): number {
  const interest = capital * rate;
  return interest - depositTax(interest, keyRate);
}

export function requiredCapital(
  targetAnnual: number,
  rate: number,
  inflation: number,
  keyRate: number,
): CapitalNeed {
  const taxFreeAmount = TAX_FREE_BASE * keyRate;
  const empty: CapitalNeed = {
    possible: false,
    capitalToday: 0,
    annualInterest: 0,
    annualTax: 0,
    netInterest: 0,
    inflationReserve: 0,
    annualWithdrawal: targetAnnual,
    netYield: 0,
    realSpread: 0,
    taxFreeAmount,
  };

  if (targetAnnual <= 0 || rate <= 0) return empty;

  const probe = 1e12;
  const probeSurplus = netInterest(probe, rate, keyRate) - probe * inflation;
  if (probeSurplus < targetAnnual) return empty;

  let lo = 0;
  let hi = probe;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    const surplus = netInterest(mid, rate, keyRate) - mid * inflation;
    if (surplus >= targetAnnual) hi = mid;
    else lo = mid;
  }

  const capitalToday = hi;
  const annualInterest = capitalToday * rate;
  const annualTax = depositTax(annualInterest, keyRate);
  const net = annualInterest - annualTax;

  return {
    possible: true,
    capitalToday,
    annualInterest,
    annualTax,
    netInterest: net,
    inflationReserve: capitalToday * inflation,
    annualWithdrawal: net - capitalToday * inflation,
    netYield: capitalToday > 0 ? net / capitalToday : 0,
    realSpread: capitalToday > 0 ? net / capitalToday - inflation : 0,
    taxFreeAmount,
  };
}

export function simulateAccumulation(options: {
  monthlySaving: number;
  rate: number;
  inflation: number;
  keyRate: number;
  capitalToday: number;
  indexContributions: boolean;
  maxYears: number;
}): YearRow[] {
  const {
    monthlySaving,
    rate,
    inflation,
    keyRate,
    capitalToday,
    indexContributions,
    maxYears,
  } = options;

  let balance = 0;
  let contrib = monthlySaving;
  const history: YearRow[] = [];

  for (let year = 1; year <= maxYears; year += 1) {
    let yearInterest = 0;
    let yearContrib = 0;

    for (let month = 0; month < 12; month += 1) {
      balance += contrib;
      yearContrib += contrib;
      const interest = balance * (rate / 12);
      balance += interest;
      yearInterest += interest;
      if (indexContributions) {
        contrib *= (1 + inflation) ** (1 / 12);
      }
    }

    const tax = depositTax(yearInterest, keyRate);
    balance -= tax;
    const deflator = (1 + inflation) ** year;
    history.push({
      year,
      balance,
      needed: capitalToday * deflator,
      tax,
      interest: yearInterest,
      contributions: yearContrib,
      realBalance: deflator > 0 ? balance / deflator : balance,
    });
  }

  return history;
}

export function yearsToGoal(history: YearRow[]): number | null {
  const hit = history.find((row) => row.needed > 0 && row.balance >= row.needed);
  return hit ? hit.year : null;
}

export function requiredMonthlySaving(options: {
  years: number;
  capitalToday: number;
  rate: number;
  inflation: number;
  keyRate: number;
  indexContributions: boolean;
}): PaymentGoal {
  const { years, capitalToday, rate, inflation, keyRate, indexContributions } =
    options;
  const needed = capitalToday * (1 + inflation) ** years;

  if (capitalToday <= 0 || years <= 0) {
    return { years, payment: 0, possible: true };
  }

  let lo = 0;
  let hi = 50_000_000;
  let found = false;

  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const history = simulateAccumulation({
      monthlySaving: mid,
      rate,
      inflation,
      keyRate,
      capitalToday,
      indexContributions,
      maxYears: years,
    });
    const last = history[history.length - 1];
    if (last && last.balance >= needed) {
      hi = mid;
      found = true;
    } else {
      lo = mid;
    }
  }

  return { years, payment: found ? hi : hi, possible: found };
}

export function buildPlan(inputs: PlanInputs): PlanResult {
  const maxYears = inputs.maxYears ?? MAX_SEARCH_YEARS;
  const targetAnnual = inputs.monthlyWithdrawal * 12;
  const need = requiredCapital(
    targetAnnual,
    inputs.depositRate,
    inputs.inflation,
    inputs.keyRate,
  );

  const history = need.possible
    ? simulateAccumulation({
        monthlySaving: inputs.monthlySaving,
        rate: inputs.depositRate,
        inflation: inputs.inflation,
        keyRate: inputs.keyRate,
        capitalToday: need.capitalToday,
        indexContributions: inputs.indexContributions,
        maxYears,
      })
    : simulateAccumulation({
        monthlySaving: inputs.monthlySaving,
        rate: inputs.depositRate,
        inflation: inputs.inflation,
        keyRate: inputs.keyRate,
        capitalToday: 0,
        indexContributions: inputs.indexContributions,
        maxYears: Math.min(40, maxYears),
      }).map((row) => ({ ...row, needed: Number.POSITIVE_INFINITY }));

  const years = need.possible ? yearsToGoal(history) : null;
  const last = history[history.length - 1];

  const monthlyToFinish = need.possible
    ? [15, 20, 25].map((horizon) =>
        requiredMonthlySaving({
          years: horizon,
          capitalToday: need.capitalToday,
          rate: inputs.depositRate,
          inflation: inputs.inflation,
          keyRate: inputs.keyRate,
          indexContributions: inputs.indexContributions,
        }),
      )
    : [];

  return {
    need,
    years,
    history,
    reached: years !== null,
    finalBalance: last?.balance ?? 0,
    finalNeeded: last?.needed ?? 0,
    monthlyToFinish,
    banksForInsurance: need.possible
      ? Math.max(1, Math.ceil(need.capitalToday / DIA_LIMIT))
      : 0,
  };
}

export type ScenarioCard = {
  id: string;
  title: string;
  subtitle: string;
  depositRate: number;
  inflation: number;
  keyRate: number;
};

export const PRESET_SCENARIOS: ScenarioCard[] = [
  {
    id: "now",
    title: "Как сегодня",
    subtitle: "Вклад 14%, инфляция 7%",
    depositRate: 0.14,
    inflation: 0.07,
    keyRate: 0.14,
  },
  {
    id: "avg",
    title: "Средние 8–10%",
    subtitle: "Вклад 9%, инфляция всё ещё 7%",
    depositRate: 0.09,
    inflation: 0.07,
    keyRate: 0.09,
  },
  {
    id: "cbr",
    title: "К цели ЦБ",
    subtitle: "Вклад 9%, инфляция 4%",
    depositRate: 0.09,
    inflation: 0.04,
    keyRate: 0.09,
  },
];
