"use client";

import { useMemo, useState } from "react";
import { AccumulationChart } from "@/components/accumulation-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PLAN,
  DEFAULT_TAX,
  PRESET_SCENARIOS,
  buildPlan,
  depositTax,
  type PlanResult,
  type TaxParams,
} from "@/lib/calc";
import { banksRu, formatPercent, formatRub, formatRubCompact, yearsRu } from "@/lib/format";

function FieldControl({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  inputValue,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  inputValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={inputValue}
            min={min}
            max={max}
            step={step}
            className="h-8 w-28 text-right tabular-nums"
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(next);
            }}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">{display}</span>
        </div>
      </div>
      <Slider
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3"
    >
      <div className="space-y-1">
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function resultHeadline(
  plan: PlanResult,
  monthlySaving: number,
  maxYears: number,
): { title: string; text: string; tone: "ok" | "warn" | "bad" } {
  if (plan.alreadyFunded) {
    return {
      title: "Уже хватает",
      text: `Стартовый капитал покрывает нужные ${formatRubCompact(plan.need.capitalToday)}. Можно начинать снимать, не дожидаясь накоплений.`,
      tone: "ok",
    };
  }
  if (!plan.need.possible) {
    return {
      title: "Так капитал не сохранится",
      text: "После налога и выбранных правил ставка не обгоняет инфляцию. Даже если ничего не снимать, покупательная способность будет таять.",
      tone: "bad",
    };
  }
  if (!plan.reached) {
    return {
      title: `За ${yearsRu(maxYears)} не догнать`,
      text: `Нужно ${formatRubCompact(plan.need.capitalToday)} в сегодняшних деньгах, но при взносе ${formatRub(monthlySaving)} цель растёт слишком быстро.`,
      tone: "warn",
    };
  }
  return {
    title: yearsRu(plan.years ?? 0),
    text: `Через ${yearsRu(plan.years ?? 0)} на вкладе будет около ${formatRubCompact(plan.finalBalance)}. С этого капитала после ваших правил как раз остаётся ${formatRub(plan.need.annualWithdrawal / 12)} в месяц в сегодняшних деньгах.`,
    tone: "ok",
  };
}

export function Calculator() {
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(DEFAULT_PLAN.monthlyWithdrawal);
  const [monthlySaving, setMonthlySaving] = useState(DEFAULT_PLAN.monthlySaving);
  const [startingCapital, setStartingCapital] = useState(DEFAULT_PLAN.startingCapital);
  const [depositRatePct, setDepositRatePct] = useState(DEFAULT_PLAN.depositRate * 100);
  const [inflationPct, setInflationPct] = useState(DEFAULT_PLAN.inflation * 100);
  const [keyRatePct, setKeyRatePct] = useState(DEFAULT_PLAN.keyRate * 100);
  const [keyFollowsDeposit, setKeyFollowsDeposit] = useState(true);
  const [indexContributions, setIndexContributions] = useState(false);
  const [indexWithdrawal, setIndexWithdrawal] = useState(true);
  const [preserveRealCapital, setPreserveRealCapital] = useState(true);
  const [spendDownYears, setSpendDownYears] = useState(30);
  const [useStartingCapital, setUseStartingCapital] = useState(false);
  const [applyTax, setApplyTax] = useState(true);
  const [useKeyRateLimit, setUseKeyRateLimit] = useState(true);
  const [taxFreeBase, setTaxFreeBase] = useState(DEFAULT_TAX.taxFreeBase);
  const [manualTaxFree, setManualTaxFree] = useState(DEFAULT_TAX.manualTaxFree);
  const [pitLowPct, setPitLowPct] = useState(DEFAULT_TAX.pitLow * 100);
  const [pitHighPct, setPitHighPct] = useState(DEFAULT_TAX.pitHigh * 100);
  const [pitThreshold, setPitThreshold] = useState(DEFAULT_TAX.pitThreshold);
  const [diaLimit, setDiaLimit] = useState(DEFAULT_PLAN.diaLimit);
  const [maxYears, setMaxYears] = useState(DEFAULT_PLAN.maxYears);
  const [activePreset, setActivePreset] = useState("now");

  const keyRate = (keyFollowsDeposit ? depositRatePct : keyRatePct) / 100;
  const tax = useMemo<TaxParams>(
    () => ({
      applyTax,
      useKeyRateLimit,
      taxFreeBase,
      manualTaxFree,
      pitLow: pitLowPct / 100,
      pitHigh: pitHighPct / 100,
      pitThreshold,
    }),
    [
      applyTax,
      useKeyRateLimit,
      taxFreeBase,
      manualTaxFree,
      pitLowPct,
      pitHighPct,
      pitThreshold,
    ],
  );
  const effectiveStarting = useStartingCapital ? startingCapital : 0;

  const plan = useMemo(
    () =>
      buildPlan({
        monthlyWithdrawal,
        monthlySaving,
        startingCapital: effectiveStarting,
        depositRate: depositRatePct / 100,
        inflation: inflationPct / 100,
        keyRate,
        indexContributions,
        indexWithdrawal,
        preserveRealCapital,
        spendDownYears,
        tax,
        diaLimit,
        maxYears,
      }),
    [
      monthlyWithdrawal,
      monthlySaving,
      effectiveStarting,
      depositRatePct,
      inflationPct,
      keyRate,
      indexContributions,
      indexWithdrawal,
      preserveRealCapital,
      spendDownYears,
      tax,
      diaLimit,
      maxYears,
    ],
  );
  const headline = resultHeadline(plan, monthlySaving, maxYears);

  const presetPlans = useMemo(
    () =>
      PRESET_SCENARIOS.map((scenario) => ({
        scenario,
        plan: buildPlan({
          monthlyWithdrawal,
          monthlySaving,
          startingCapital: effectiveStarting,
          depositRate: scenario.depositRate,
          inflation: scenario.inflation,
          keyRate: scenario.keyRate,
          indexContributions,
          indexWithdrawal,
          preserveRealCapital,
          spendDownYears,
          tax,
          diaLimit,
          maxYears,
        }),
      })),
    [
      monthlyWithdrawal,
      monthlySaving,
      effectiveStarting,
      indexContributions,
      indexWithdrawal,
      preserveRealCapital,
      spendDownYears,
      tax,
      diaLimit,
      maxYears,
    ],
  );

  function applyPreset(id: string) {
    const scenario = PRESET_SCENARIOS.find((item) => item.id === id);
    if (!scenario) return;
    setActivePreset(id);
    setDepositRatePct(scenario.depositRate * 100);
    setInflationPct(scenario.inflation * 100);
    setKeyRatePct(scenario.keyRate * 100);
    setKeyFollowsDeposit(true);
  }

  function markCustom() {
    setActivePreset("custom");
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
            Все параметры можно менять
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:gap-14">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-sm text-primary">Личный расчёт, не банковская витрина</p>
            <h1 className="font-heading max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
              Сколько лет копить, чтобы каждый месяц снимать {formatRub(monthlyWithdrawal)}
              {preserveRealCapital
                ? " и не проедать капитал"
                : `, а потом проесть его за ${yearsRu(spendDownYears)}`}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
              Меняйте суммы, ставки и правила. Тумблеры включают индексацию взноса, рост снятия с инфляцией, вечную ренту, налог и стартовый капитал.
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
                При ваших текущих настройках
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
            const title = presetPlan.alreadyFunded
              ? "Уже хватает"
              : !presetPlan.need.possible
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

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Цифры</CardTitle>
                <CardDescription>
                  Можно двигать ползунок или вписать точное значение.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FieldControl
                  label="Сколько нужно в месяц"
                  hint="В сегодняшних рублях"
                  value={monthlyWithdrawal}
                  min={10_000}
                  max={500_000}
                  step={5_000}
                  display={formatRub(monthlyWithdrawal)}
                  inputValue={String(monthlyWithdrawal)}
                  onChange={(value) => {
                    setMonthlyWithdrawal(Math.max(0, value));
                    markCustom();
                  }}
                />
                <FieldControl
                  label="Откладываете каждый месяц"
                  hint="Пока копите, ничего не снимаете"
                  value={monthlySaving}
                  min={0}
                  max={500_000}
                  step={5_000}
                  display={formatRub(monthlySaving)}
                  inputValue={String(monthlySaving)}
                  onChange={(value) => {
                    setMonthlySaving(Math.max(0, value));
                    markCustom();
                  }}
                />
                <FieldControl
                  label="Ставка вклада, %"
                  value={depositRatePct}
                  min={1}
                  max={25}
                  step={0.1}
                  display={formatPercent(depositRatePct / 100)}
                  inputValue={String(Number(depositRatePct.toFixed(1)))}
                  onChange={(value) => {
                    setDepositRatePct(value);
                    markCustom();
                  }}
                />
                <FieldControl
                  label="Инфляция, %"
                  value={inflationPct}
                  min={0}
                  max={20}
                  step={0.1}
                  display={formatPercent(inflationPct / 100)}
                  inputValue={String(Number(inflationPct.toFixed(1)))}
                  onChange={(value) => {
                    setInflationPct(value);
                    markCustom();
                  }}
                />
                <FieldControl
                  label="Искать цель не дольше, лет"
                  value={maxYears}
                  min={10}
                  max={80}
                  step={1}
                  display={yearsRu(maxYears)}
                  inputValue={String(maxYears)}
                  onChange={(value) => setMaxYears(Math.round(value))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Тумблеры и правила</CardTitle>
                <CardDescription>
                  Выключайте то, что не хотите закладывать в модель.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow
                  id="index-contrib"
                  label="Индексировать взнос с инфляцией"
                  hint="Каждый месяц откладываемая сумма растёт вместе с ценами. Иначе 50 000 ₽ через 10 лет уже не те деньги."
                  checked={indexContributions}
                  onChange={setIndexContributions}
                />
                <ToggleRow
                  id="index-withdraw"
                  label="Индексировать снятие с инфляцией"
                  hint="Через годы на жизнь нужно больше номинальных рублей. Если выключить, считаем вечные 100 000 ₽ без роста."
                  checked={indexWithdrawal}
                  onChange={setIndexWithdrawal}
                />
                <ToggleRow
                  id="preserve-capital"
                  label="Не проедать капитал"
                  hint="После налога капитал должен расти не медленнее инфляции. Выключите, если согласны потратить тело вклада."
                  checked={preserveRealCapital}
                  onChange={setPreserveRealCapital}
                />
                {!preserveRealCapital && (
                  <div className="rounded-xl bg-muted/60 p-4">
                    <FieldControl
                      label="Капитал можно проесть за, лет"
                      value={spendDownYears}
                      min={5}
                      max={60}
                      step={1}
                      display={yearsRu(spendDownYears)}
                      inputValue={String(spendDownYears)}
                      onChange={(value) => setSpendDownYears(Math.round(value))}
                    />
                  </div>
                )}
                <ToggleRow
                  id="apply-tax"
                  label="Учитывать НДФЛ с процентов"
                  hint="13% до порога и 15% свыше. Если выключить, считаем вклад как будто налога нет."
                  checked={applyTax}
                  onChange={setApplyTax}
                />
                <ToggleRow
                  id="key-follow"
                  label="Ключевая ставка = ставке вклада"
                  hint="От ключевой ставки считается необлагаемый лимит: 1 млн ₽ × ставка."
                  checked={keyFollowsDeposit}
                  onChange={setKeyFollowsDeposit}
                />
                {!keyFollowsDeposit && (
                  <div className="rounded-xl bg-muted/60 p-4">
                    <FieldControl
                      label="Ключевая ставка ЦБ, %"
                      value={keyRatePct}
                      min={1}
                      max={25}
                      step={0.1}
                      display={formatPercent(keyRatePct / 100)}
                      inputValue={String(Number(keyRatePct.toFixed(1)))}
                      onChange={setKeyRatePct}
                    />
                  </div>
                )}
                <ToggleRow
                  id="use-start"
                  label="Учитывать стартовый капитал"
                  hint="Если на вкладе уже что-то лежит, это сокращает срок."
                  checked={useStartingCapital}
                  onChange={setUseStartingCapital}
                />
                {useStartingCapital && (
                  <div className="rounded-xl bg-muted/60 p-4">
                    <FieldControl
                      label="Уже накоплено"
                      value={startingCapital}
                      min={0}
                      max={80_000_000}
                      step={100_000}
                      display={formatRub(startingCapital)}
                      inputValue={String(startingCapital)}
                      onChange={(value) => setStartingCapital(Math.max(0, value))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {applyTax && (
              <Card>
                <CardHeader>
                  <CardTitle>Параметры налога</CardTitle>
                  <CardDescription>
                    По умолчанию как у ФНС: лимит 1 млн ₽ × ключ, 13% и 15%.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ToggleRow
                    id="tax-limit-law"
                    label="Необлагаемый лимит по ключевой ставке"
                    hint="1 000 000 ₽ × максимальная ключевая ставка. Выключите, чтобы задать лимит вручную."
                    checked={useKeyRateLimit}
                    onChange={setUseKeyRateLimit}
                  />
                  {useKeyRateLimit ? (
                    <FieldControl
                      label="База лимита, ₽"
                      value={taxFreeBase}
                      min={0}
                      max={5_000_000}
                      step={50_000}
                      display={formatRub(taxFreeBase)}
                      inputValue={String(taxFreeBase)}
                      onChange={(value) => setTaxFreeBase(Math.max(0, value))}
                    />
                  ) : (
                    <FieldControl
                      label="Необлагаемые проценты в год, ₽"
                      value={manualTaxFree}
                      min={0}
                      max={5_000_000}
                      step={10_000}
                      display={formatRub(manualTaxFree)}
                      inputValue={String(manualTaxFree)}
                      onChange={(value) => setManualTaxFree(Math.max(0, value))}
                    />
                  )}
                  <FieldControl
                    label="НДФЛ до порога, %"
                    value={pitLowPct}
                    min={0}
                    max={22}
                    step={0.5}
                    display={formatPercent(pitLowPct / 100)}
                    inputValue={String(Number(pitLowPct.toFixed(1)))}
                    onChange={setPitLowPct}
                  />
                  <FieldControl
                    label="Порог повышенной ставки, ₽"
                    value={pitThreshold}
                    min={0}
                    max={10_000_000}
                    step={100_000}
                    display={formatRub(pitThreshold)}
                    inputValue={String(pitThreshold)}
                    onChange={(value) => setPitThreshold(Math.max(0, value))}
                  />
                  <FieldControl
                    label="НДФЛ свыше порога, %"
                    value={pitHighPct}
                    min={0}
                    max={22}
                    step={0.5}
                    display={formatPercent(pitHighPct / 100)}
                    inputValue={String(Number(pitHighPct.toFixed(1)))}
                    onChange={setPitHighPct}
                  />
                  <Separator />
                  <FieldControl
                    label="Лимит АСВ на один банк, ₽"
                    value={diaLimit}
                    min={100_000}
                    max={10_000_000}
                    step={100_000}
                    display={formatRub(diaLimit)}
                    inputValue={String(diaLimit)}
                    onChange={(value) => setDiaLimit(Math.max(1, value))}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Что происходит с деньгами</CardTitle>
                <CardDescription>
                  {indexWithdrawal
                    ? "Пунктир растёт вместе с инфляцией: через годы на ту же жизнь нужно больше рублей."
                    : "Пунктир не растёт: считаем, что номинального снятия хватит и через годы."}
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
                hint={
                  preserveRealCapital
                    ? "Столько нужно, если начать снимать уже сегодня и не худеть капиталу"
                    : `Хватит, чтобы снимать ${yearsRu(spendDownYears)} и проесть тело вклада`
                }
              />
              <Stat
                label="После налога остаётся"
                value={plan.need.possible ? formatPercent(plan.need.netYield) : "—"}
                hint={
                  plan.need.possible
                    ? `Инфляция ${formatPercent(inflationPct / 100)}, на жизнь ${formatPercent(plan.need.realSpread)}`
                    : "Номинальная ставка после ваших правил ниже инфляции"
                }
              />
              <Stat
                label="Налог в год на целевом капитале"
                value={applyTax && plan.need.possible ? formatRub(plan.need.annualTax) : applyTax ? "—" : "выключен"}
                hint={
                  applyTax
                    ? `Не облагается ${formatRub(plan.need.taxFreeAmount)} процентов`
                    : "НДФЛ в этой модели не учитывается"
                }
              />
              <Stat
                label="Страхование АСВ"
                value={plan.need.possible ? banksRu(plan.banksForInsurance) : "—"}
                hint={`Лимит ${formatRub(diaLimit)} на один банк`}
              />
            </div>

            {plan.need.possible && (
              <Card>
                <CardHeader>
                  <CardTitle>Если хотите уложиться быстрее</CardTitle>
                  <CardDescription>
                    Какой нужен ежемесячный взнос, чтобы выйти на цель за 15, 20 или 25 лет.
                    {indexContributions
                      ? " Взнос растёт с инфляцией — здесь сумма первого месяца."
                      : " Взнос фиксированный."}
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
                <CardTitle>Как читать модель</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Если включена вечная рента и индексация снятия, формула такая: проценты после налога минус инфляция на капитал равны годовому снятию {formatRub(monthlyWithdrawal * 12)}.
                </p>
                <p>
                  При ставке {formatPercent(depositRatePct / 100)} и инфляции {formatPercent(inflationPct / 100)}
                  {plan.need.possible
                    ? ` нужно около ${formatRubCompact(plan.need.capitalToday)}.`
                    : " конечного капитала нет: после налога ставка не обгоняет цены."}
                </p>
                <p>
                  Это учебный расчёт, а не финансовая рекомендация. Ставки, налог и лимит АСВ можно поменять выше, если закон или ваш банк другие.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="manual-interest">Проверьте налог на своих процентах</Label>
                  <TaxPreview keyRate={keyRate} tax={tax} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>Семейный капитал · настраиваемый расчёт ренты с вклада</p>
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

function TaxPreview({ keyRate, tax }: { keyRate: number; tax: TaxParams }) {
  const [interest, setInterest] = useState(3_230_000);
  const due = useMemo(() => depositTax(interest, keyRate, tax), [interest, keyRate, tax]);

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
        налог {formatRub(due)} · на руки {formatRub(interest - due)}
      </p>
    </div>
  );
}
