import { buildPlan, mergePlanInputs, type PlanInputs, type PlanResult } from "./calc";
import { yearsRu } from "./format";

export type AlternativeId =
  | "spend20"
  | "spend30"
  | "noIndex"
  | "halfSpend30"
  | "equity"
  | "pds"
  | "rent";

export type AlternativeCard = {
  id: AlternativeId;
  title: string;
  possible: boolean;
  capitalToday: number;
  years: number | null;
  alreadyFunded: boolean;
  applyable: boolean;
  summary: string;
};

export function buildAlternativePlans(partial: Partial<PlanInputs>): {
  baseline: PlanResult;
  cards: AlternativeCard[];
} {
  const inputs = mergePlanInputs(partial);
  const baseline = buildPlan(inputs);

  const spend20 = buildPlan({
    ...inputs,
    preserveRealCapital: false,
    spendDownYears: 20,
  });
  const spend30 = buildPlan({
    ...inputs,
    preserveRealCapital: false,
    spendDownYears: 30,
  });
  const noIndex = buildPlan({
    ...inputs,
    indexWithdrawal: false,
  });
  const halfSpend30 = buildPlan({
    ...inputs,
    monthlyWithdrawal: Math.max(10_000, Math.round(inputs.monthlyWithdrawal / 2)),
    preserveRealCapital: false,
    spendDownYears: 30,
  });
  const equityRate = inputs.inflation + 0.04;
  const equity = buildPlan({
    ...inputs,
    depositRate: equityRate,
    keyRate: equityRate,
    tax: { ...inputs.tax, pitHigh: inputs.tax.pitLow },
  });

  const cards: AlternativeCard[] = [
    {
      id: "spend20",
      title: "Проесть капитал за 20 лет",
      possible: spend20.need.possible,
      capitalToday: spend20.need.capitalToday,
      years: spend20.years,
      alreadyFunded: spend20.alreadyFunded,
      applyable: true,
      summary:
        "Капитал не обязан жить вечно. Снимаете нужную сумму 20 лет, тело вклада тоже идёт в расход. Потом счёт пустой — зато копить реалистичнее.",
    },
    {
      id: "spend30",
      title: "Проесть капитал за 30 лет",
      possible: spend30.need.possible,
      capitalToday: spend30.need.capitalToday,
      years: spend30.years,
      alreadyFunded: spend30.alreadyFunded,
      applyable: true,
      summary:
        "Тот же принцип, но дольше. Ближе к «жене не работать до старости», чем вечная рента, и всё ещё в человеческий горизонт.",
    },
    {
      id: "halfSpend30",
      title: "Снимать половину, остальное с работы",
      possible: halfSpend30.need.possible,
      capitalToday: halfSpend30.need.capitalToday,
      years: halfSpend30.years,
      alreadyFunded: halfSpend30.alreadyFunded,
      applyable: true,
      summary: `Капитал закрывает ${Math.round(inputs.monthlyWithdrawal / 2).toLocaleString("ru-RU")} ₽, вторую половину даёт подработка, частичная ставка или другой доход. Вечную ренту на полную сумму при узком спреде это не заменяет — поэтому здесь капитал тоже можно проесть за 30 лет.`,
    },
    {
      id: "noIndex",
      title: "Не индексировать снятие",
      possible: noIndex.need.possible,
      capitalToday: noIndex.need.capitalToday,
      years: noIndex.years,
      alreadyFunded: noIndex.alreadyFunded,
      applyable: true,
      summary:
        "Каждый год снимаете одну и ту же номинальную сумму. Копить легче, но через 10 лет эти деньги купят заметно меньше. Покупательная способность капитала всё равно поддерживается, падает только снятие.",
    },
    {
      id: "equity",
      title: "Портфель с ~4% сверх инфляции",
      possible: equity.need.possible,
      capitalToday: equity.need.capitalToday,
      years: equity.years,
      alreadyFunded: equity.alreadyFunded,
      applyable: false,
      summary:
        "Акции, фонды, смесь с облигациями исторически могут давать больше вклада после инфляции. В расчёте заложено инфляции + 4% и налог как 13%. Это не обещание: рынок может просесть на годы, 100 000 ₽ в месяц с него не гарантированы.",
    },
    {
      id: "pds",
      title: "ПДС и ИИС-3",
      possible: true,
      capitalToday: 0,
      years: null,
      alreadyFunded: false,
      applyable: false,
      summary:
        "Государство по программе долгосрочных сбережений добавляет до 36 000 ₽ в год 10 лет подряд и страхует до 2,8 млн ₽. На взносы в ПДС и ИИС-3 общий вычет до 400 000 ₽ в год — возврат примерно 52 000 ₽ при ставке 13%. Это ускоряет накопление, но само по себе не заменяет 100 000 ₽ в месяц навсегда.",
    },
    {
      id: "rent",
      title: "Квартира в аренду",
      possible: true,
      capitalToday: 0,
      years: null,
      alreadyFunded: false,
      applyable: false,
      summary:
        "Сданная однушка или двушка в крупном городе часто даёт десятки тысяч в месяц, не сто тысяч после ремонта, простоя и налога. Ренту можно индексировать, но это отдельный бизнес: ликвидность ниже вклада, АСВ нет. Имеет смысл как кусок дохода, не как единственный план.",
    },
  ];

  return { baseline, cards };
}

export function outcomeLabel(card: AlternativeCard): string {
  if (!card.applyable && card.id === "pds") return "до +36 000 ₽ / год";
  if (!card.applyable && card.id === "rent") return "часть дохода";
  if (!card.possible) return "всё ещё не сходится";
  if (card.alreadyFunded) return "уже хватает";
  if (card.years === null) return "капитал меньше, срок всё ещё длинный";
  return `${yearsRu(card.years)} копить`;
}
