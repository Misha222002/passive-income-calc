"use client";

import type { ReactNode } from "react";
import { explainCashflow, type PlanResult, type TaxParams, type YearRow } from "@/lib/calc";
import { formatPercent, formatRub, yearsRu } from "@/lib/format";

const EXAMPLE_CAPITAL = 10_000_000;

type Props = {
  monthlyWithdrawal: number;
  monthlySaving: number;
  depositRate: number;
  inflation: number;
  keyRate: number;
  tax: TaxParams;
  applyTax: boolean;
  indexContributions: boolean;
  indexWithdrawal: boolean;
  preserveRealCapital: boolean;
  spendDownYears: number;
  plan: PlanResult;
};

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-5">
      <span className="font-heading flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
        {n}
      </span>
      <div className="space-y-2">
        <h3 className="font-heading text-lg">{title}</h3>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-b-0 ${
        strong ? "text-foreground" : ""
      }`}
    >
      <span>{label}</span>
      <span className="font-heading tabular-nums">{value}</span>
    </div>
  );
}

function CashflowTable({ flow, applyTax }: { flow: ReturnType<typeof explainCashflow>; applyTax: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <Line label="На вкладе" value={formatRub(flow.capital)} />
      <Line label="Проценты за год" value={formatRub(flow.interest)} />
      {applyTax ? (
        <>
          <Line label="Не облагается налогом" value={formatRub(flow.taxFree)} />
          <Line label="НДФЛ" value={`− ${formatRub(flow.taxPaid)}`} />
          <Line label="Проценты после налога" value={formatRub(flow.netInterest)} />
        </>
      ) : (
        <Line label="Налог выключен" value={formatRub(0)} />
      )}
      <Line label="Вернуть на вклад из‑за инфляции" value={`− ${formatRub(flow.inflationReserve)}`} />
      <Line label="Остаётся на жизнь за год" value={formatRub(flow.leftover)} strong />
      <Line label="Это в месяц" value={formatRub(flow.monthlyLeftover)} strong />
    </div>
  );
}

function milestoneYears(history: YearRow[], goalYear: number | null): YearRow[] {
  if (history.length === 0) return [];
  const last = goalYear ?? history.length;
  const picks = new Set([1, Math.max(1, Math.round(last / 2)), last]);
  return history.filter((row) => picks.has(row.year) && Number.isFinite(row.needed));
}

export function NumberStory({
  monthlyWithdrawal,
  monthlySaving,
  depositRate,
  inflation,
  keyRate,
  tax,
  applyTax,
  indexContributions,
  indexWithdrawal,
  preserveRealCapital,
  spendDownYears,
  plan,
}: Props) {
  const target = plan.need.possible ? plan.need.capitalToday : EXAMPLE_CAPITAL;
  const targetFlow = explainCashflow(target, depositRate, inflation, keyRate, tax);
  const tenFlow = explainCashflow(EXAMPLE_CAPITAL, depositRate, inflation, keyRate, tax);
  const shortfall = monthlyWithdrawal - tenFlow.monthlyLeftover;
  const marks = milestoneYears(plan.history, plan.years);

  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-8">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Откуда цифры</p>
      <h2 className="font-heading mt-2 max-w-3xl text-3xl leading-tight">
        Почему капитал {plan.need.possible ? formatRub(plan.need.capitalToday) : "не сходится"} и срок
        {plan.reached ? ` ${yearsRu(plan.years ?? 0)}` : " такой длинный"}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Цифры не из потолка. Считаем один год жизни с готового вклада: банк начислил проценты, из них вычли налог,
        часть вернули на вклад, чтобы он не дешевел, остаток можно снимать. Капитал подобран так, чтобы остаток как
        раз был равен {formatRub(monthlyWithdrawal)} в месяц.
      </p>

      <ol className="mt-8 space-y-8">
        <Step n={1} title="На счёте лежит капитал">
          <p>
            Берём сумму, с которой уже можно жить. Для вашего расчёта это{" "}
            <span className="text-foreground">{formatRub(target)}</span>
            {plan.need.possible ? " в сегодняшних деньгах." : " — пример, потому что с текущими ставками вечной ренты нет."}
          </p>
        </Step>

        <Step n={2} title={`Банк начисляет ${formatPercent(depositRate)} годовых`}>
          <p>
            За год проценты такие: {formatRub(target)} × {formatPercent(depositRate)} ={" "}
            <span className="text-foreground">{formatRub(targetFlow.interest)}</span>.
            Это ещё не ваши карманные деньги: сначала налог, потом инфляция.
          </p>
        </Step>

        <Step n={3} title={applyTax ? "С процентов снимают НДФЛ" : "Налог в этой модели выключен"}>
          {applyTax ? (
            <>
              <p>
                Налогом облагаются не все проценты. Необлагаемый кусок:{" "}
                {formatRub(targetFlow.taxFree)}. С превышения — {formatPercent(tax.pitLow)} до{" "}
                {formatRub(tax.pitThreshold)} базы и {formatPercent(tax.pitHigh)} дальше.
              </p>
              <p>
                Налог с {formatRub(targetFlow.interest)} получается{" "}
                <span className="text-foreground">{formatRub(targetFlow.taxPaid)}</span>
                {targetFlow.taxAtHigh > 0
                  ? `: ${formatRub(targetFlow.taxAtLow)} по обычной ставке и ${formatRub(targetFlow.taxAtHigh)} по повышенной.`
                  : "."}{" "}
                После налога остаётся {formatRub(targetFlow.netInterest)}.
              </p>
            </>
          ) : (
            <p>Вы выключили НДФЛ, поэтому на руки идёт вся сумма процентов: {formatRub(targetFlow.netInterest)}.</p>
          )}
        </Step>

        <Step n={4} title="Часть процентов оставляем на вкладе">
          {preserveRealCapital ? (
            <p>
              Цены растут на {formatPercent(inflation)} в год. Чтобы {formatRub(target)} через год покупали столько же,
              на вклад нужно вернуть {formatRub(target)} × {formatPercent(inflation)} ={" "}
              <span className="text-foreground">{formatRub(targetFlow.inflationReserve)}</span>. Это не трата, а
              реинвестирование: капитал номинально растёт, а по смыслу стоит на месте.
            </p>
          ) : (
            <p>
              Тумблер «не проедать капитал» выключен: тело вклада можно тратить {yearsRu(spendDownYears)}. Тогда
              резерв на инфляцию меньше давит, и нужный капитал меньше. Но через {yearsRu(spendDownYears)} счёт
              опустеет.
            </p>
          )}
        </Step>

        <Step n={5} title="Остаток делим на 12 — это и есть ежемесячное снятие">
          <p>
            {formatRub(targetFlow.netInterest)} после налога минус {formatRub(targetFlow.inflationReserve)} на инфляцию ={" "}
            <span className="text-foreground">{formatRub(targetFlow.leftover)}</span> в год, или{" "}
            <span className="text-foreground">{formatRub(targetFlow.monthlyLeftover)}</span> в месяц.
          </p>
          {plan.need.possible && preserveRealCapital ? (
            <p>
              Капитал подобран так, чтобы эта месячная сумма совпала с вашими{" "}
              {formatRub(monthlyWithdrawal)}. Если нужно больше на жизнь — капитал должен быть больше. Если ставка
              выше или инфляция ниже — хватит меньшей суммы.
            </p>
          ) : null}
          <CashflowTable flow={targetFlow} applyTax={applyTax} />
        </Step>
      </ol>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-heading text-xl">А если на счёте ровно 10 млн ₽?</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Та же ставка {formatPercent(depositRate)}, та же инфляция {formatPercent(inflation)}. Смотрите, сколько
            останется на жизнь — и почему 10 млн обычно мало для {formatRub(monthlyWithdrawal)} в месяц.
          </p>
          <CashflowTable flow={tenFlow} applyTax={applyTax} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {tenFlow.monthlyLeftover >= monthlyWithdrawal ? (
              <>
                С 10 млн после налога и инфляции выходит {formatRub(tenFlow.monthlyLeftover)} в месяц — этого уже
                хватает на ваши {formatRub(monthlyWithdrawal)}.
              </>
            ) : tenFlow.leftover <= 0 ? (
              <>
                С 10 млн после налога и инфляции на жизнь не остаётся ничего: {formatRub(tenFlow.monthlyLeftover)} в
                месяц. Капитал даже худеет. Поэтому в расчёте нужна сумма больше, либо ниже инфляция, либо выше ставка.
              </>
            ) : (
              <>
                С 10 млн на жизнь остаётся {formatRub(tenFlow.monthlyLeftover)} в месяц. До ваших{" "}
                {formatRub(monthlyWithdrawal)} не хватает {formatRub(shortfall)} каждый месяц. Поэтому калькулятор
                ищет капитал крупнее: чем больше вклад, тем больше «лишние» проценты сверх инфляции.
              </>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-heading text-xl">Почему копить приходится так долго</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Пока копите, каждый месяц кладёте {formatRub(monthlySaving)}
            {indexContributions ? ", и этот взнос растёт вместе с инфляцией" : " одной и той же номинальной суммой"}.
            На уже лежащие деньги банк тоже капает проценты, с них снова налог.
          </p>
          {indexWithdrawal ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Цель тоже не стоит на месте. Через год {formatRub(monthlyWithdrawal)} в сегодняшних ценах — это уже{" "}
              {formatRub(monthlyWithdrawal * (1 + inflation))} номиналом. Поэтому нужный капитал растёт, и догонять
              его взносом {formatRub(monthlySaving)} бывает трудно.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Индексация снятия выключена: цель в рублях не растёт. Копить легче, но через 10 лет те же{" "}
              {formatRub(monthlyWithdrawal)} купят меньше.
            </p>
          )}
          {marks.length > 0 && (
            <div className="rounded-xl bg-muted/60 px-4 py-3">
              {marks.map((row) => (
                <Line
                  key={row.year}
                  label={`${row.year}-й год: накоплено / нужно`}
                  value={`${formatRub(row.balance)} / ${Number.isFinite(row.needed) ? formatRub(row.needed) : "—"}`}
                />
              ))}
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {plan.alreadyFunded
              ? "Стартовый капитал уже покрывает цель — копить не нужно."
              : plan.reached
                ? `На ${plan.years}-м году накопленное впервые догоняет нужную сумму. Отсюда и срок ${yearsRu(plan.years ?? 0)}.`
                : "За выбранный горизонт накопления цель так и не догоняется: либо взнос мал, либо ставка почти не обгоняет инфляцию."}
          </p>
        </div>
      </div>
    </section>
  );
}
