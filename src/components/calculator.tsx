"use client";

import { useMemo, useState } from "react";
import { AccumulationChart } from "@/components/accumulation-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  buildPlan,
  depositTax,
  PRESET_SCENARIOS,
  type PlanInputs,
  type PlanResult,
} from "@/lib/calc";
import { banksRu, formatPercent, formatRub, formatRubCompact, yearsRu } from "@/lib/format";

const DEFAULTS: PlanInputs = {
  monthlyWithdrawal: 100_000,
  monthlySaving: 50_000,
  depositRate: 0.14,
  inflation: 0.07,
  keyRate: 0.14,
  indexContributions: false,
};

function FieldSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="font-heading text-sm tabular-nums">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}

function resultHeadline(plan: PlanResult): { title: string; text: string; tone: "ok" | "warn" | "bad" } {
  if (!plan.need.possible) {
    return {
      title: "Так капитал не сохранится",
      text: "После налога ставка вклада не обгоняет инфляцию. Даже если ничего не снимать, покупательная способность будет таять.",
      tone: "bad",
    };
  }
  if (!plan.reached) {
    return {
      title: "За жизнь на 50 000 ₽ в месяц не догнать",
      text: `Нужно ${formatRubCompact(plan.need.capitalToday)} в сегодняшних деньгах, но цель растёт почти так же быстро, как вклад. Фиксированного взноса не хватает.`,
      tone: "warn",
    };
  }
  return {
    title: yearsRu(plan.years ?? 0),
    text: `Через ${yearsRu(plan.years ?? 0)} на вкладе будет около ${formatRubCompact(plan.finalBalance)}. С этого капитала после налога и инфляции как раз остаётся ${formatRub(plan.need.annualWithdrawal / 12)} в месяц в сегодняшней покупательной способности.`,
    tone: "ok",
  };
}

export function Calculator() {
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(DEFAULTS.monthlyWithdrawal);
  const [monthlySaving, setMonthlySaving] = useState(DEFAULTS.monthlySaving);
  const [depositRatePct, setDepositRatePct] = useState(14);
  const [inflationPct, setInflationPct] = useState(7);
  const [keyRatePct, setKeyRatePct] = useState(14);
  const [keyFollowsDeposit, setKeyFollowsDeposit] = useState(true);
  const [indexContributions, setIndexContributions] = useState(false);
  const [activePreset, setActivePreset] = useState("now");

  const keyRate = (keyFollowsDeposit ? depositRatePct : keyRatePct) / 100;

  const plan = useMemo(
    () =>
      buildPlan({
        monthlyWithdrawal,
        monthlySaving,
        depositRate: depositRatePct / 100,
        inflation: inflationPct / 100,
        keyRate,
        indexContributions,
      }),
    [
      monthlyWithdrawal,
      monthlySaving,
      depositRatePct,
      inflationPct,
      keyRate,
      indexContributions,
    ],
  );
  const headline = resultHeadline(plan);

  const presetPlans = useMemo(() => {
    return PRESET_SCENARIOS.map((scenario) => ({
      scenario,
      plan: buildPlan({
        monthlyWithdrawal,
        monthlySaving,
        depositRate: scenario.depositRate,
        inflation: scenario.inflation,
        keyRate: scenario.keyRate,
        indexContributions,
      }),
    }));
  }, [monthlyWithdrawal, monthlySaving, indexContributions]);

  function applyPreset(id: string) {
    const scenario = PRESET_SCENARIOS.find((item) => item.id === id);
    if (!scenario) return;
    setActivePreset(id);
    setDepositRatePct(scenario.depositRate * 100);
    setInflationPct(scenario.inflation * 100);
    setKeyRatePct(scenario.keyRate * 100);
    setKeyFollowsDeposit(true);
  }

  const visibleHistory = plan.need.possible
    ? plan.history
    : plan.history.map((row) => ({ ...row, needed: Number.NaN }));

  return (
    <div className="min-h-full bg-[image:var(--page-glow)]">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Семейный капитал
            </p>
            <p className="font-heading text-sm">Вклад, налог и инфляция</p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Данные ЦБ и ФНС · ноябрь 2026
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:gap-14">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-sm text-primary">Личный расчёт, не банковская витрина</p>
            <h1 className="font-heading max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
              Сколько лет копить, чтобы каждый месяц снимать {formatRub(monthlyWithdrawal)} и не проедать капитал
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
              Задача такая: на вкладе должен оставаться запас, который после НДФЛ обгоняет инфляцию ровно на нужные 100 000 ₽ в месяц. Сами 100 000 ₽ тоже дорожают вместе с ценами. Откладываете 50 000 ₽ каждый месяц.
            </p>
          </div>
          <Card
            className={
              headline.tone === "ok"
                ? "bg-primary text-primary-foreground ring-0"
                : headline.tone === "warn"
                  ? "bg-[oklch(0.42_0.08_55)] text-primary-foreground ring-0"
                  : "bg-[oklch(0.38_0.09_28)] text-primary-foreground ring-0"
            }
          >
            <CardHeader>
              <CardDescription className="text-primary-foreground/70">
                При ваших текущих ползунках
              </CardDescription>
              <CardTitle className="font-heading text-4xl leading-none sm:text-5xl">
                {headline.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-primary-foreground/85">
              {headline.text}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {presetPlans.map(({ scenario, plan: presetPlan }) => {
            const selected = activePreset === scenario.id;
            const title = !presetPlan.need.possible
              ? "Невозможно"
              : !presetPlan.reached
                ? "Не догнать"
                : yearsRu(presetPlan.years ?? 0);
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => applyPreset(scenario.id)}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  selected
                    ? "border-primary bg-card shadow-sm"
                    : "border-border bg-card/70 hover:border-primary/40"
                }`}
              >
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {scenario.title}
                </p>
                <p className="font-heading mt-2 text-2xl">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{scenario.subtitle}</p>
                <p className="mt-4 text-sm">
                  Капитал сегодня:{" "}
                  {presetPlan.need.possible
                    ? formatRubCompact(presetPlan.need.capitalToday)
                    : "нет конечной суммы"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Реальная надбавка после налога:{" "}
                  {presetPlan.need.possible
                    ? formatPercent(presetPlan.need.realSpread)
                    : "ниже инфляции"}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Ваши цифры</CardTitle>
              <CardDescription>
                Ставка 14% — как сейчас. 8–10% — то среднее, которое вы просили заложить на длинную дистанцию.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FieldSlider
                label="Сколько нужно жене в месяц"
                hint="В сегодняшних рублях"
                value={monthlyWithdrawal}
                min={20_000}
                max={300_000}
                step={5_000}
                display={formatRub(monthlyWithdrawal)}
                onChange={setMonthlyWithdrawal}
              />
              <FieldSlider
                label="Откладываете каждый месяц"
                hint="Пока копите, ничего не снимаете"
                value={monthlySaving}
                min={10_000}
                max={400_000}
                step={5_000}
                display={formatRub(monthlySaving)}
                onChange={setMonthlySaving}
              />
              <FieldSlider
                label="Ставка вклада"
                hint="Сейчас около 14%, на годы вперёд разумнее 8–10%"
                value={depositRatePct}
                min={4}
                max={18}
                step={0.1}
                display={formatPercent(depositRatePct / 100)}
                onChange={(value) => {
                  setDepositRatePct(value);
                  setActivePreset("custom");
                }}
              />
              <FieldSlider
                label="Инфляция"
                hint="Сентябрь 2026: 6,4%. ЦБ ждёт 7,1–7,6% по итогам года"
                value={inflationPct}
                min={2}
                max={15}
                step={0.1}
                display={formatPercent(inflationPct / 100)}
                onChange={(value) => {
                  setInflationPct(value);
                  setActivePreset("custom");
                }}
              />
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/70 px-3 py-3">
                <div>
                  <Label htmlFor="index-contrib">Индексировать взнос с инфляцией</Label>
                  <p className="text-xs text-muted-foreground">
                    Иначе 50 000 ₽ через 10 лет уже не те деньги
                  </p>
                </div>
                <Switch
                  id="index-contrib"
                  checked={indexContributions}
                  onCheckedChange={setIndexContributions}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/70 px-3 py-3">
                <div>
                  <Label htmlFor="key-follow">Ключевая ставка = ставке вклада</Label>
                  <p className="text-xs text-muted-foreground">
                    От неё считается необлагаемый лимит: 1 млн ₽ × ставка
                  </p>
                </div>
                <Switch
                  id="key-follow"
                  checked={keyFollowsDeposit}
                  onCheckedChange={setKeyFollowsDeposit}
                />
              </div>
              {!keyFollowsDeposit && (
                <FieldSlider
                  label="Ключевая ставка ЦБ"
                  value={keyRatePct}
                  min={4}
                  max={21}
                  step={0.1}
                  display={formatPercent(keyRatePct / 100)}
                  onChange={setKeyRatePct}
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Что происходит с деньгами</CardTitle>
                <CardDescription>
                  Пунктир растёт вместе с инфляцией: через годы 100 000 ₽ уже не хватит, нужна большая сумма.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccumulationChart history={visibleHistory} years={plan.years} />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Капитал в сегодняшних деньгах"
                value={plan.need.possible ? formatRubCompact(plan.need.capitalToday) : "нет решения"}
                hint="Столько нужно, если начать снимать уже сегодня"
              />
              <Stat
                label="После налога остаётся"
                value={plan.need.possible ? formatPercent(plan.need.netYield) : "—"}
                hint={
                  plan.need.possible
                    ? `Инфляция съедает ${formatPercent(inflationPct / 100)}, на жизнь ${formatPercent(plan.need.realSpread)}`
                    : "Номинальная ставка после НДФЛ ниже инфляции"
                }
              />
              <Stat
                label="Налог в год на целевом капитале"
                value={plan.need.possible ? formatRub(plan.need.annualTax) : "—"}
                hint={`Не облагается ${formatRub(plan.need.taxFreeAmount)} процентов. Дальше 13%, свыше 2,4 млн базы — 15%`}
              />
              <Stat
                label="Страхование АСВ"
                value={plan.need.possible ? banksRu(plan.banksForInsurance) : "—"}
                hint="Лимит 1,4 млн ₽ на один банк. Крупный капитал придётся дробить"
              />
            </div>
          </div>
        </section>

        {plan.need.possible && (
          <Card>
            <CardHeader>
              <CardTitle>Если хотите уложиться быстрее</CardTitle>
              <CardDescription>
                Сколько нужно откладывать каждый месяц, чтобы выйти на цель за 15, 20 или 25 лет.
                {indexContributions
                  ? " Взнос растёт вместе с инфляцией — здесь сумма первого месяца."
                  : " Взнос фиксированный, без индексации."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {plan.monthlyToFinish.map((goal) => (
                <div key={goal.years} className="rounded-xl bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground uppercase">{yearsRu(goal.years)}</p>
                  <p className="font-heading mt-1 text-2xl">
                    {goal.possible ? formatRub(goal.payment) : "не выйдет"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">в месяц</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Почему 8–10% при инфляции 7% почти не работают</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Вы хотите не просто вклад, а вечную ренту: каждый год капитал должен вырасти на инфляцию, и только то, что сверху, можно снимать. Формула такая:{" "}
              <span className="text-foreground">
                проценты после налога − инфляция × капитал = 1,2 млн ₽ в год
              </span>
              .
            </p>
            <p>
              При ставке 14% и инфляции 7% после НДФЛ остаётся примерно 12,2%. Разница 5,2% — и тогда хватает капитала около {formatRubCompact(buildPlan({ ...DEFAULTS }).need.capitalToday)}. Откладывая 50 000 ₽, вы добираете его за 29 лет. Если каждый год поднимать взнос на инфляцию — за 21 год.
            </p>
            <p>
              При средних 8–10% и той же инфляции 7% разница после налога почти исчезает. На 8% налог съедает реальную доходность целиком: капитал худеет даже без снятий. На 9–10% цель либо недостижима с фиксированными 50 000 ₽, либо растягивается на всю жизнь.
            </p>
            <p>
              Более реалистичный длинный сценарий — не «ставки упадут, а инфляция останется», а «оба числа снизятся». ЦБ целится в инфляцию 4% и ждёт ключевую 7,5–10% к 2028–2029. Тогда 9% на вкладе и 4% инфляции снова дают понятный горизонт: около 38 лет с фиксированными 50 000 ₽ или 29 лет, если взнос растёт с инфляцией.
            </p>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Как именно считаем налог</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                НДФЛ берётся не с тела вклада, а с процентов. Необлагаемый лимит = 1 млн ₽ × максимальная ключевая ставка за год. В 2025 году это было 210 000 ₽, в 2026-м пока 160 000 ₽ при ключевой 16% на 1 января.
              </p>
              <p>
                С превышения: 13% до 2,4 млн ₽ налоговой базы и 15% выше. Проценты по вкладам — отдельная база, с зарплатой их не складывают. В модели налог вычитается в конце каждого года, капитализация ежемесячная.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="manual-interest">Проверьте налог на своих процентах</Label>
                <TaxPreview keyRate={keyRate} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Что модель не обещает</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Это учебный расчёт, а не финансовая рекомендация. Ставки не стоят на месте: сегодня максимумы топ-10 банков около 13%, а не ровно 14%. На длинном горизонте вклад редко на годы обгоняет инфляцию на 7 пунктов.
              </p>
              <p>
                АСВ страхует только 1,4 млн ₽ в одном банке. На 23–70 млн ₽ нужно много банков или принятие риска. Налог платится по уведомлению на следующий год — в модели мы упрощаем это до вычета в конце года.
              </p>
              <p>
                Если согласиться когда-нибудь проесть капитал, а не держать его вечно, цель станет ближе. Но это уже другая задача: не «жена не работает всегда», а «хватает на N лет».
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6 sm:flex-row sm:justify-between">
          <p>Семейный капитал · расчёт вечной ренты с вклада в России</p>
          <p>Не является индивидуальной инвестиционной рекомендацией</p>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs leading-relaxed text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function TaxPreview({ keyRate }: { keyRate: number }) {
  const [interest, setInterest] = useState(3_230_000);
  const tax = useMemo(() => depositTax(interest, keyRate), [interest, keyRate]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        id="manual-interest"
        type="number"
        inputMode="numeric"
        value={interest}
        onChange={(event) => setInterest(Number(event.target.value) || 0)}
        className="sm:max-w-48"
      />
      <p className="text-sm text-foreground">
        налог {formatRub(tax)} · на руки {formatRub(interest - tax)}
      </p>
    </div>
  );
}
