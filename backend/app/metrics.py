"""スクリーニングで使える指標のカタログ。

画面（単位の表示・入力欄）とエンジン（比較・計算）が同じ定義を見るように、
指標の定義はここ1か所に集約する。

`historical` は「過去のある時点の値を、その時点で公表済みだったデータだけから
再現できるか」を表す。再現できない指標はバックテストでは使えない。
"""
from __future__ import annotations

from dataclasses import dataclass

# 比較演算子（将来 OR 条件や between を足せるよう、文字列で持つ）
OPERATORS: dict[str, str] = {
    "<=": "以下",
    ">=": "以上",
    "<": "未満",
    ">": "超",
    "==": "等しい",
}


@dataclass(frozen=True)
class MetricDef:
    id: str
    label: str
    unit: str            # 倍 / % / 億円 / 円
    category: str
    decimals: int
    historical: bool     # 過去時点の値を再現できるか（バックテストで使えるか）
    note: str = ""


CATEGORIES: dict[str, str] = {
    "valuation": "バリュエーション",
    "growth": "成長性",
    "profitability": "収益性",
    "financial": "財務",
    "size": "企業規模",
    "price": "株価",
    "technical": "テクニカル",
}

METRICS: tuple[MetricDef, ...] = (
    # バリュエーション
    MetricDef("pbr", "PBR", "倍", "valuation", 2, True, "株価 ÷ 1株あたり純資産"),
    MetricDef("per", "PER", "倍", "valuation", 1, True, "株価 ÷ 1株あたり純利益"),
    MetricDef(
        "dividendYield", "配当利回り", "%", "valuation", 2, False,
        "過去時点の配当実績を再現できないため、バックテストでは使えません",
    ),
    # 成長性
    MetricDef("revenueGrowth", "売上高成長率", "%", "growth", 1, True, "前期比"),
    MetricDef("operatingIncomeGrowth", "営業利益成長率", "%", "growth", 1, True, "前期比"),
    MetricDef("epsGrowth", "EPS成長率", "%", "growth", 1, True, "前期比"),
    # 収益性
    MetricDef("roe", "ROE", "%", "profitability", 1, True, "純利益 ÷ 自己資本"),
    MetricDef("roa", "ROA", "%", "profitability", 1, True, "純利益 ÷ 総資産"),
    MetricDef("operatingMargin", "営業利益率", "%", "profitability", 1, True, "営業利益 ÷ 売上高"),
    # 財務
    MetricDef("equityRatio", "自己資本比率", "%", "financial", 1, True, "自己資本 ÷ 総資産"),
    MetricDef("debtRatio", "有利子負債比率", "%", "financial", 1, True, "有利子負債 ÷ 自己資本"),
    # 企業規模（米国株は円換算して比較する）
    MetricDef("marketCap", "時価総額", "億円", "size", 0, True, "米国株は円換算"),
    MetricDef("revenue", "売上高", "億円", "size", 0, True, "米国株は円換算"),
    MetricDef("price", "株価", "円", "price", 0, True, "米国株は円換算"),
    # 騰落率
    MetricDef("return1m", "1か月騰落率", "%", "price", 1, True),
    MetricDef("return3m", "3か月騰落率", "%", "price", 1, True),
    MetricDef("return6m", "6か月騰落率", "%", "price", 1, True),
    MetricDef("return12m", "1年騰落率", "%", "price", 1, True),
    # テクニカル
    MetricDef("volumeGrowth", "出来高増加率", "%", "technical", 1, True, "直近10日平均 ÷ 3か月平均"),
    MetricDef(
        "distanceFrom52wHigh", "52週高値からの乖離率", "%", "technical", 1, True,
        "高値を0%として、いまどれだけ下にいるか（マイナス表示）",
    ),
)

METRIC_BY_ID: dict[str, MetricDef] = {m.id: m for m in METRICS}

HISTORICAL_METRIC_IDS: frozenset[str] = frozenset(m.id for m in METRICS if m.historical)


def get(metric_id: str) -> MetricDef | None:
    return METRIC_BY_ID.get(metric_id)


def compare(value: float, operator: str, threshold: float) -> bool:
    """条件を満たすか。未知の演算子は False（勝手に通さない）。"""
    if operator == "<=":
        return value <= threshold
    if operator == ">=":
        return value >= threshold
    if operator == "<":
        return value < threshold
    if operator == ">":
        return value > threshold
    if operator == "==":
        return abs(value - threshold) < 1e-9
    return False
