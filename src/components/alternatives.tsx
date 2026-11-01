"use client";

import {
  buildAlternativePlans,
  outcomeLabel,
  type AlternativeId,
} from "@/lib/alternatives";
import type { PlanInputs } from "@/lib/calc";
import { formatRub, formatRubCompact, yearsRu } from "@/lib/format";

type Props = {
  inputs: Partial<PlanInputs>;
  onApply: (id: AlternativeId) => void;
};

export function Alternatives({ inputs, onApply }: Props) {
  const { baseline, cards } = buildAlternativePlans(inputs);
  const perpetualStuck = !baseline.need.possible || baseline.years === null;

  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-8">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Другие пути</p>
      <h2 className="font-heading mt-2 max-w-3xl text-3xl leading-tight">
        Если вклад не тянет вечную ренту, меняют не магию процентов, а саму задачу
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        При узком зазоре между ставкой и инфляцией откладывать {formatRub(inputs.monthlySaving ?? 0)} и
        вечно снимать {formatRub(inputs.monthlyWithdrawal ?? 0)} без потери покупательной способности почти
        нереально: нужен капитал
        {baseline.need.possible ? ` около ${formatRubCompact(baseline.need.capitalToday)}` : ", которого после налога нет"}.
        {perpetualStuck
          ? " Ниже — варианты, которые с теми же ставками уже считаются."
          : " Даже если вечная рента сходится, эти пути короче или спокойнее."}{" "}
        Это не рекомендация, а карта развилок.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.id} className="flex flex-col rounded-xl border border-border bg-background p-5">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{outcomeLabel(card)}</p>
            <h3 className="font-heading mt-2 text-xl">{card.title}</h3>
            {card.applyable && card.possible ? (
              <p className="mt-2 text-sm">
                Нужно {formatRubCompact(card.capitalToday)}
                {card.alreadyFunded
                  ? ""
                  : card.years !== null
                    ? ` · копить ${yearsRu(card.years)}`
                    : " · за выбранный горизонт не догнать"}
              </p>
            ) : null}
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{card.summary}</p>
            {card.applyable ? (
              <button
                type="button"
                onClick={() => onApply(card.id)}
                className="mt-4 self-start rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                Поставить в калькулятор
              </button>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Считается отдельно, не вклад в калькуляторе.</p>
            )}
          </article>
        ))}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Самая честная сборка для семьи часто такая: копить на вкладе и в ПДС/ИИС, пока ставки высокие; не обещать
        капиталу вечную жизнь; закрыть часть расходов работой или арендой; если готовы к риску — держать кусок в
        фондах, а не ждать от вклада 4% сверх инфляции. Кнопка выше только переключает правила этой модели, не
        открывает брокерский счёт.
      </p>
    </section>
  );
}
