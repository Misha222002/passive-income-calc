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

function CashflowTable({
  flow,
  applyTax,
  depositRate,
}: {
  flow: ReturnType<typeof explainCashflow>;
  applyTax: boolean;
  depositRate: number;
}) {
  const netYield = flow.capital > 0 ? flow.netInterest / flow.capital : 0;
  const taxShare = flow.interest > 0 ? flow.taxPaid / flow.interest : 0;
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <Line label="На вкладе" value={formatRub(flow.capital)} />
      <Line
        label={`Проценты за год, ${formatPercent(depositRate)}`}
        value={formatRub(flow.interest)}
      />
      {applyTax ? (
        <>
          <Line label="Не облагается налогом" value={formatRub(flow.taxFree)} />
          <Line label="НДФЛ" value={`− ${formatRub(flow.taxPaid)}`} />
          <Line label="Налог от всех процентов" value={formatPercent(taxShare, 2)} />
          <Line label="Проценты после налога" value={formatRub(flow.netInterest)} />
          <Line
            label="Доходность после налога"
            value={`${formatRub(flow.netInterest)} ÷ ${formatRub(flow.capital)} = ${formatPercent(netYield, 2)}`}
            strong
          />
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
  const netYield = target > 0 ? targetFlow.netInterest / target : 0;
  const taxShare = targetFlow.interest > 0 ? targetFlow.taxPaid / targetFlow.interest : 0;
  const naiveLow = depositRate * (1 - tax.pitLow);
  const naiveHigh = depositRate * (1 - tax.pitHigh);
  const tenYield = tenFlow.capital > 0 ? tenFlow.netInterest / tenFlow.capital : 0;

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
                Карточка «после налога остаётся {formatPercent(netYield, 1)}» — это не ставка банка минус{" "}
                {formatPercent(tax.pitLow)}. Формула такая:
              </p>
              <p className="rounded-xl bg-primary/5 px-4 py-3 text-foreground">
                доходность после налога = (проценты − НДФЛ) ÷ капитал = {formatRub(targetFlow.netInterest)} ÷{" "}
                {formatRub(target)} = {formatPercent(netYield, 2)}
              </p>
              <p>
                Необлагаемый кусок маленький: 1 млн ₽ × ключевая {formatPercent(keyRate)} ={" "}
                {formatRub(targetFlow.taxFree)}. На большом капитале это почти не чувствуется. Налоговая база:{" "}
                {formatRub(targetFlow.taxable)}.
              </p>
              <p>
                Дальше лестница. Первые {formatRub(tax.pitThreshold)} базы × {formatPercent(tax.pitLow)} ={" "}
                {formatRub(targetFlow.taxAtLow)}. Всё, что выше, × {formatPercent(tax.pitHigh)} ={" "}
                {formatRub(targetFlow.taxAtHigh)}. Итого налог{" "}
                <span className="text-foreground">{formatRub(targetFlow.taxPaid)}</span> — это{" "}
                {formatPercent(taxShare, 2)} всех процентов, ближе к {formatPercent(tax.pitHigh)}, чем к{" "}
                {formatPercent(tax.pitLow)}.
              </p>
              <p>
                Поэтому ждать {formatPercent(depositRate)} × (1 − {formatPercent(tax.pitLow)}) ={" "}
                {formatPercent(naiveLow, 2)} не стоит. На таком капитале почти все проценты уже в зоне{" "}
                {formatPercent(tax.pitHigh)}: {formatPercent(depositRate)} × (1 − {formatPercent(tax.pitHigh)}) ={" "}
                {formatPercent(naiveHigh, 2)}. Необлагаемый лимит и кусок по {formatPercent(tax.pitLow)} чуть
                поднимают результат до {formatPercent(netYield, 2)}.
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
          <CashflowTable flow={targetFlow} applyTax={applyTax} depositRate={depositRate} />
        </Step>
      </ol>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-heading text-xl">А если на счёте ровно 10 млн ₽?</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Та же ставка {formatPercent(depositRate)}, та же инфляция {formatPercent(inflation)}. Смотрите, сколько
            останется на жизнь — и почему 10 млн обычно мало для {formatRub(monthlyWithdrawal)} в месяц.
          </p>
          <CashflowTable flow={tenFlow} applyTax={applyTax} depositRate={depositRate} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            На 10 млн проценты ещё не дотягивают до порога {formatRub(tax.pitThreshold)}, поэтому налог почти весь
            по {formatPercent(tax.pitLow)}, и доходность после налога выше: {formatPercent(tenYield, 2)} вместо{" "}
            {formatPercent(netYield, 2)} на целевом капитале.
          </p>
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
