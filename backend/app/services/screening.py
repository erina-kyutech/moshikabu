"""スクリーニングエンジン（純粋関数）。

条件（AND）と、銘柄ごとの指標スナップショットを受け取り、条件を満たす銘柄を返す。
データ取得はここでは行わない。

大事な方針:
  指標が取れない銘柄を「条件を満たす」と扱わない。
  0 や推定値で埋めず、「データなし」として除外し、理由を返す。
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .. import metrics
from ..providers.base import Fundamentals


@dataclass(frozen=True)
class Condition:
    metric: str
    operator: str
    value: float

    @property
    def label(self) -> str:
        m = metrics.get(self.metric)
        op = metrics.OPERATORS.get(self.operator, self.operator)
        if m is None:
            return f"{self.metric} {op} {self.value}"
        return f"{m.label} {self.value:g}{m.unit} {op}"


@dataclass(frozen=True)
class ConditionCheck:
    metric: str
    operator: str
    threshold: float
    actual: float | None
    passed: bool


@dataclass(frozen=True)
class ScreenRow:
    ticker: str
    values: dict[str, float]
    checks: list[ConditionCheck]
    matched: bool
    fiscal_period_end: str | None = None
    published_on: str | None = None


@dataclass(frozen=True)
class ConditionStat:
    """条件1つだけで見たときの通過数。0件だったときにどれが効いたのかを示す。"""

    metric: str
    operator: str
    threshold: float
    evaluated: int
    """その指標を取得できた銘柄数"""
    passed: int
    """そのうち、この条件を満たした銘柄数"""


@dataclass(frozen=True)
class ScreenResult:
    matched: list[ScreenRow] = field(default_factory=list)
    rejected: list[ScreenRow] = field(default_factory=list)
    """条件を満たさなかった銘柄（結果一覧には出さないが件数として扱う）"""
    excluded: dict[str, str] = field(default_factory=dict)
    """データ不足などで判定できなかった銘柄 → 理由"""
    stats: list[ConditionStat] = field(default_factory=list)
    """条件ごとの通過数（AND を外して1条件ずつ数えたもの）"""


class ScreeningError(Exception):
    pass


def validate(conditions: list[Condition], *, require_historical: bool = False) -> None:
    if not conditions:
        raise ScreeningError("条件を1つ以上指定してください。")
    for c in conditions:
        m = metrics.get(c.metric)
        if m is None:
            raise ScreeningError(f"未対応の指標です: {c.metric}")
        if c.operator not in metrics.OPERATORS:
            raise ScreeningError(f"未対応の比較条件です: {c.operator}")
        if require_historical and not m.historical:
            raise ScreeningError(
                f"「{m.label}」は過去時点の値を再現できないため、バックテストでは使えません。"
            )


def check(conditions: list[Condition], snapshot: Fundamentals) -> ScreenRow:
    """1銘柄を判定する。必要な指標が1つでも欠けていれば matched=False。"""
    checks: list[ConditionCheck] = []
    matched = True
    for c in conditions:
        actual = snapshot.values.get(c.metric)
        passed = actual is not None and metrics.compare(actual, c.operator, c.value)
        if not passed:
            matched = False
        checks.append(
            ConditionCheck(
                metric=c.metric, operator=c.operator, threshold=c.value, actual=actual, passed=passed
            )
        )
    return ScreenRow(
        ticker=snapshot.ticker,
        values=dict(snapshot.values),
        checks=checks,
        matched=matched,
        fiscal_period_end=snapshot.fiscal_period_end.isoformat() if snapshot.fiscal_period_end else None,
        published_on=snapshot.published_on.isoformat() if snapshot.published_on else None,
    )


def screen(
    conditions: list[Condition],
    snapshots: dict[str, Fundamentals | None],
) -> ScreenResult:
    """条件（AND）で絞り込む。

    snapshots の値が None の銘柄は「その時点のデータを取得できなかった」ものとして
    除外する（条件を満たすとも満たさないとも判定しない）。
    """
    validate(conditions)
    result = ScreenResult()
    needed = {c.metric for c in conditions}
    evaluated = [0] * len(conditions)
    passed = [0] * len(conditions)

    for ticker, snapshot in snapshots.items():
        if snapshot is None:
            result.excluded[ticker] = "財務データを取得できませんでした"
            continue

        missing = [m for m in needed if m not in snapshot.values]
        if missing:
            labels = [metrics.get(m).label if metrics.get(m) else m for m in missing]
            result.excluded[ticker] = f"データなし（{ '・'.join(labels) }）"
            continue

        row = check(conditions, snapshot)
        (result.matched if row.matched else result.rejected).append(row)

    # AND を外し、条件1つずつの通過数を数える（データがある銘柄だけを母数にする）
    for i, c in enumerate(conditions):
        for snapshot in snapshots.values():
            if snapshot is None:
                continue
            actual = snapshot.values.get(c.metric)
            if actual is None:
                continue
            evaluated[i] += 1
            if metrics.compare(actual, c.operator, c.value):
                passed[i] += 1
        result.stats.append(
            ConditionStat(
                metric=c.metric,
                operator=c.operator,
                threshold=c.value,
                evaluated=evaluated[i],
                passed=passed[i],
            )
        )

    return result
