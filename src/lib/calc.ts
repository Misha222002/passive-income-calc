/** Налоговые и страховые константы РФ на 2025–2026 гг. */
export const TAX_FREE_BASE = 1_000_000;
export const PIT_THRESHOLD = 2_400_000;
export const PIT_LOW = 0.13;
export const PIT_HIGH = 0.15;
export const DIA_LIMIT = 1_400_000;
export const MAX_SEARCH_YEARS = 80;

export type TaxParams = {
  applyTax: boolean;
  useKeyRateLimit: boolean;
  taxFreeBase: number;
  manualTaxFree: number;
  pitLow: number;
  pitHigh: number;
  pitThreshold: number;
};

export const DEFAULT_TAX: TaxParams = {
  applyTax: true,
  useKeyRateLimit: true,
  taxFreeBase: TAX_FREE_BASE,
  manualTaxFree: 210_000,
  pitLow: PIT_LOW,
  pitHigh: PIT_HIGH,
  pitThreshold: PIT_THRESHOLD,
};

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
  startingCapital: number;
  depositRate: number;
  inflation: number;
  keyRate: number;
  indexContributions: boolean;
  indexWithdrawal: boolean;
  preserveRealCapital: boolean;
  spendDownYears: number;
  tax: TaxParams;
  diaLimit: number;
  maxYears: number;
};

export const DEFAULT_PLAN: PlanInputs = {
  monthlyWithdrawal: 100_000,
  monthlySaving: 50_000,
  startingCapital: 0,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
  indexContributions: false,
  indexWithdrawal: true,
  preserveRealCapital: true,
  spendDownYears: 30,
  tax: DEFAULT_TAX,
  diaLimit: DIA_LIMIT,
  maxYears: MAX_SEARCH_YEARS,
};

export type PlanResult = {
  need: CapitalNeed;
  years: number | null;
  history: YearRow[];
  reached: boolean;
  alreadyFunded: boolean;
  finalBalance: number;
  finalNeeded: number;
  monthlyToFinish: PaymentGoal[];
  banksForInsurance: number;
};

export function taxFreeAmount(keyRate: number, tax: TaxParams): number {
  if (!tax.applyTax) return Number.POSITIVE_INFINITY;
  return tax.useKeyRateLimit ? tax.taxFreeBase * keyRate : tax.manualTaxFree;
}

export function depositTax(
  interest: number,
  keyRate: number,
  tax: TaxParams = DEFAULT_TAX,
): number {
  if (!tax.applyTax) return 0;
  const taxable = Math.max(0, interest - taxFreeAmount(keyRate, tax));
  if (taxable <= tax.pitThreshold) return taxable * tax.pitLow;
  return tax.pitThreshold * tax.pitLow + (taxable - tax.pitThreshold) * tax.pitHigh;
}

export function netInterest(
  capital: number,
  rate: number,
  keyRate: number,
  tax: TaxParams = DEFAULT_TAX,
): number {
  const interest = capital * rate;
  return interest - depositTax(interest, keyRate, tax);
}

function emptyNeed(targetAnnual: number, keyRate: number, tax: TaxParams): CapitalNeed {
  return {
    possible: false,
    capitalToday: 0,
    annualInterest: 0,
    annualTax: 0,
    netInterest: 0,
    inflationReserve: 0,
    annualWithdrawal: targetAnnual,
    netYield: 0,
    realSpread: 0,
    taxFreeAmount: tax.applyTax ? taxFreeAmount(keyRate, tax) : 0,
  };
}

function fillNeed(
  capitalToday: number,
  rate: number,
  inflation: number,
  keyRate: number,
  tax: TaxParams,
  targetAnnual: number,
): CapitalNeed {
  const annualInterest = capitalToday * rate;
  const annualTax = depositTax(annualInterest, keyRate, tax);
  const net = annualInterest - annualTax;
  return {
    possible: true,
    capitalToday,
    annualInterest,
    annualTax,
    netInterest: net,
    inflationReserve: capitalToday * inflation,
    annualWithdrawal: targetAnnual,
    netYield: capitalToday > 0 ? net / capitalToday : 0,
    realSpread: capitalToday > 0 ? net / capitalToday - inflation : 0,
    taxFreeAmount: tax.applyTax ? taxFreeAmount(keyRate, tax) : 0,
  };
}

function perpetualSurplus(
  capital: number,
  rate: number,
  inflation: number,
  keyRate: number,
  tax: TaxParams,
  reserveInflation: boolean,
): number {
  const net = netInterest(capital, rate, keyRate, tax);
  return reserveInflation ? net - capital * inflation : net;
}

export function requiredPerpetualCapital(options: {
  targetAnnual: number;
  rate: number;
  inflation: number;
  keyRate: number;
  tax: TaxParams;
  reserveInflation: boolean;
}): CapitalNeed {
  const { targetAnnual, rate, inflation, keyRate, tax, reserveInflation } = options;
  const empty = emptyNeed(targetAnnual, keyRate, tax);
  if (targetAnnual <= 0 || rate <= 0) return empty;

  const probe = 1e12;
  if (perpetualSurplus(probe, rate, inflation, keyRate, tax, reserveInflation) < targetAnnual) {
    return empty;
  }

  let lo = 0;
  let hi = probe;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (perpetualSurplus(mid, rate, inflation, keyRate, tax, reserveInflation) >= targetAnnual) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return fillNeed(hi, rate, inflation, keyRate, tax, targetAnnual);
}

function spendDownSurvives(options: {
  capital: number;
  monthlyWithdrawal: number;
  rate: number;
  inflation: number;
  keyRate: number;
  tax: TaxParams;
  years: number;
  indexWithdrawal: boolean;
}): boolean {
  const { monthlyWithdrawal, rate, inflation, keyRate, tax, years, indexWithdrawal } = options;
  let balance = options.capital;
  let withdrawal = monthlyWithdrawal;

  for (let year = 1; year <= years; year += 1) {
    let yearInterest = 0;
    for (let month = 0; month < 12; month += 1) {
      const interest = balance * (rate / 12);
      balance += interest;
      yearInterest += interest;
      balance -= withdrawal;
      if (balance < 0) return false;
      if (indexWithdrawal) {
        withdrawal *= (1 + inflation) ** (1 / 12);
      }
    }
    balance -= depositTax(yearInterest, keyRate, tax);
    if (balance < 0) return false;
  }

  return true;
}

export function requiredSpendDownCapital(options: {
  monthlyWithdrawal: number;
  rate: number;
  inflation: number;
  keyRate: number;
  tax: TaxParams;
  years: number;
  indexWithdrawal: boolean;
}): CapitalNeed {
  const targetAnnual = options.monthlyWithdrawal * 12;
  const empty = emptyNeed(targetAnnual, options.keyRate, options.tax);
  if (options.monthlyWithdrawal <= 0 || options.years <= 0) return empty;

  let lo = 0;
  let hi = Math.max(targetAnnual * options.years * 4, 1_000_000);
  let found = false;

  for (let expand = 0; expand < 12 && !spendDownSurvives({ ...options, capital: hi }); expand += 1) {
    hi *= 2;
    if (hi > 1e12) return empty;
  }

  if (!spendDownSurvives({ ...options, capital: hi })) return empty;

  for (let i = 0; i < 56; i += 1) {
    const mid = (lo + hi) / 2;
    if (spendDownSurvives({ ...options, capital: mid })) {
      hi = mid;
      found = true;
    } else {
      lo = mid;
    }
  }

  if (!found) return empty;
  return fillNeed(hi, options.rate, options.inflation, options.keyRate, options.tax, targetAnnual);
}

export function requiredCapital(options: {
  monthlyWithdrawal: number;
  depositRate: number;
  inflation: number;
  keyRate: number;
  tax?: TaxParams;
  preserveRealCapital?: boolean;
  indexWithdrawal?: boolean;
  spendDownYears?: number;
}): CapitalNeed {
  const tax = options.tax ?? DEFAULT_TAX;
  const preserveRealCapital = options.preserveRealCapital ?? true;
  const indexWithdrawal = options.indexWithdrawal ?? true;
  const targetAnnual = options.monthlyWithdrawal * 12;

  if (preserveRealCapital) {
    return requiredPerpetualCapital({
      targetAnnual,
      rate: options.depositRate,
      inflation: options.inflation,
      keyRate: options.keyRate,
      tax,
      reserveInflation: indexWithdrawal,
    });
  }

  return requiredSpendDownCapital({
    monthlyWithdrawal: options.monthlyWithdrawal,
    rate: options.depositRate,
    inflation: options.inflation,
    keyRate: options.keyRate,
    tax,
    years: options.spendDownYears ?? 30,
    indexWithdrawal,
  });
}

export function simulateAccumulation(options: {
  monthlySaving: number;
  startingCapital: number;
  rate: number;
  inflation: number;
  keyRate: number;
  capitalToday: number;
  indexContributions: boolean;
  indexWithdrawal: boolean;
  maxYears: number;
  tax: TaxParams;
}): YearRow[] {
  const {
    monthlySaving,
    startingCapital,
    rate,
    inflation,
    keyRate,
    capitalToday,
    indexContributions,
    indexWithdrawal,
    maxYears,
    tax,
  } = options;

  let balance = startingCapital;
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

    const taxPaid = depositTax(yearInterest, keyRate, tax);
    balance -= taxPaid;
    const deflator = (1 + inflation) ** year;
    history.push({
      year,
      balance,
      needed: indexWithdrawal ? capitalToday * deflator : capitalToday,
      tax: taxPaid,
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
  startingCapital: number;
  rate: number;
  inflation: number;
  keyRate: number;
  indexContributions: boolean;
  indexWithdrawal: boolean;
  tax: TaxParams;
}): PaymentGoal {
  const {
    years,
    capitalToday,
    startingCapital,
    rate,
    inflation,
    keyRate,
    indexContributions,
    indexWithdrawal,
    tax,
  } = options;
  const needed = indexWithdrawal ? capitalToday * (1 + inflation) ** years : capitalToday;

  if (capitalToday <= 0 || years <= 0) {
    return { years, payment: 0, possible: true };
  }
  if (startingCapital >= needed) {
    return { years, payment: 0, possible: true };
  }

  let lo = 0;
  let hi = 50_000_000;
  let found = false;

  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const history = simulateAccumulation({
      monthlySaving: mid,
      startingCapital,
      rate,
      inflation,
      keyRate,
      capitalToday,
      indexContributions,
      indexWithdrawal,
      maxYears: years,
      tax,
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

export function mergePlanInputs(partial: Partial<PlanInputs> = {}): PlanInputs {
  return {
    ...DEFAULT_PLAN,
    ...partial,
    tax: { ...DEFAULT_TAX, ...partial.tax },
  };
}

export function buildPlan(partial: Partial<PlanInputs> = {}): PlanResult {
  const inputs = mergePlanInputs(partial);
  const need = requiredCapital({
    monthlyWithdrawal: inputs.monthlyWithdrawal,
    depositRate: inputs.depositRate,
    inflation: inputs.inflation,
    keyRate: inputs.keyRate,
    tax: inputs.tax,
    preserveRealCapital: inputs.preserveRealCapital,
    indexWithdrawal: inputs.indexWithdrawal,
    spendDownYears: inputs.spendDownYears,
  });

  const alreadyFunded = need.possible && inputs.startingCapital >= need.capitalToday;

  const history = need.possible
    ? simulateAccumulation({
        monthlySaving: inputs.monthlySaving,
        startingCapital: inputs.startingCapital,
        rate: inputs.depositRate,
        inflation: inputs.inflation,
        keyRate: inputs.keyRate,
        capitalToday: need.capitalToday,
        indexContributions: inputs.indexContributions,
        indexWithdrawal: inputs.indexWithdrawal,
        maxYears: inputs.maxYears,
        tax: inputs.tax,
      })
    : simulateAccumulation({
        monthlySaving: inputs.monthlySaving,
        startingCapital: inputs.startingCapital,
        rate: inputs.depositRate,
        inflation: inputs.inflation,
        keyRate: inputs.keyRate,
        capitalToday: 0,
        indexContributions: inputs.indexContributions,
        indexWithdrawal: inputs.indexWithdrawal,
        maxYears: Math.min(40, inputs.maxYears),
        tax: inputs.tax,
      }).map((row) => ({ ...row, needed: Number.POSITIVE_INFINITY }));

  const years = alreadyFunded ? 0 : need.possible ? yearsToGoal(history) : null;
  const last = history[history.length - 1];

  const monthlyToFinish = need.possible
    ? [15, 20, 25].map((horizon) =>
        requiredMonthlySaving({
          years: horizon,
          capitalToday: need.capitalToday,
          startingCapital: inputs.startingCapital,
          rate: inputs.depositRate,
          inflation: inputs.inflation,
          keyRate: inputs.keyRate,
          indexContributions: inputs.indexContributions,
          indexWithdrawal: inputs.indexWithdrawal,
          tax: inputs.tax,
        }),
      )
    : [];

  return {
    need,
    years,
    history,
    reached: years !== null,
    alreadyFunded,
    finalBalance: last?.balance ?? 0,
    finalNeeded: last?.needed ?? 0,
    monthlyToFinish,
    banksForInsurance: need.possible
      ? Math.max(1, Math.ceil(need.capitalToday / Math.max(inputs.diaLimit, 1)))
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
