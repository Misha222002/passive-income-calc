import { DEFAULT_TAX, buildPlan, explainCashflow, requiredCapital } from "./calc";

function assertClose(actual: number, expected: number, label: string, tol = 0.02) {
  const ok = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1) <= tol;
  if (!ok) {
    throw new Error(`${label}: expected ~${expected}, got ${actual}`);
  }
}

const now = requiredCapital({
  monthlyWithdrawal: 100_000,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
});
if (!now.possible) throw new Error("14/7 should be possible");
assertClose(now.capitalToday, 23_080_000, "capital 14/7", 0.03);

const avg = requiredCapital({
  monthlyWithdrawal: 100_000,
  depositRate: 0.09,
  inflation: 0.07,
  keyRate: 0.09,
});
if (!avg.possible) throw new Error("9/7 should be possible");
assertClose(avg.capitalToday, 175_150_000, "capital 9/7", 0.03);

const low = requiredCapital({
  monthlyWithdrawal: 100_000,
  depositRate: 0.08,
  inflation: 0.07,
  keyRate: 0.08,
});
if (low.possible) throw new Error("8/7 should be impossible after tax");

const yearsNow = buildPlan({
  monthlyWithdrawal: 100_000,
  monthlySaving: 50_000,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
  indexContributions: false,
});
if (yearsNow.years !== 29) {
  throw new Error(`expected 29 years at 14/7, got ${yearsNow.years}`);
}

const yearsIndexed = buildPlan({
  monthlyWithdrawal: 100_000,
  monthlySaving: 50_000,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
  indexContributions: true,
});
if (yearsIndexed.years !== 21) {
  throw new Error(`expected 21 indexed years at 14/7, got ${yearsIndexed.years}`);
}

const noTax = requiredCapital({
  monthlyWithdrawal: 100_000,
  depositRate: 0.08,
  inflation: 0.07,
  keyRate: 0.08,
  tax: {
    applyTax: false,
    useKeyRateLimit: true,
    taxFreeBase: 1_000_000,
    manualTaxFree: 0,
    pitLow: 0.13,
    pitHigh: 0.15,
    pitThreshold: 2_400_000,
  },
});
if (!noTax.possible) throw new Error("8/7 without tax should be possible");

const spendDown = buildPlan({
  monthlyWithdrawal: 100_000,
  monthlySaving: 50_000,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
  preserveRealCapital: false,
  spendDownYears: 30,
});
if (!spendDown.need.possible || spendDown.need.capitalToday >= 23_000_000) {
  throw new Error("spend-down capital should be smaller than perpetual");
}

const ten = explainCashflow(10_000_000, 0.14, 0.07, 0.14, DEFAULT_TAX);
assertClose(ten.interest, 1_400_000, "10m interest");
assertClose(ten.monthlyLeftover, 44_683, "10m monthly leftover", 0.03);

console.log("calc verification passed");
