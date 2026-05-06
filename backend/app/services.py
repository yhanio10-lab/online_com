from __future__ import annotations

from collections.abc import Iterable
from typing import Optional

from .schemas import AdMetricIn, KPIResponse, ForecastResponse


def safe_div(numerator: float, denominator: float) -> Optional[float]:
    if denominator == 0:
        return None
    return numerator / denominator


def aggregate_kpis(rows: Iterable[AdMetricIn]) -> KPIResponse:
    row_list = list(rows)
    impressions = sum(r.impressions for r in row_list)
    clicks = sum(r.clicks for r in row_list)
    cost = sum(r.cost for r in row_list)
    conversions = sum(r.conversions for r in row_list)
    revenue = sum(r.revenue for r in row_list)

    return KPIResponse(
        impressions=impressions,
        clicks=clicks,
        cost=cost,
        conversions=conversions,
        revenue=revenue,
        ctr=safe_div(clicks, impressions),
        cpc=safe_div(cost, clicks),
        cvr=safe_div(conversions, clicks),
        cpa=safe_div(cost, conversions),
        roas=safe_div(revenue, cost),
    )


def baseline_forecast(rows: Iterable[AdMetricIn], budget: float) -> ForecastResponse:
    kpi = aggregate_kpis(rows)

    avg_cpc = kpi.cpc if kpi.cpc is not None and kpi.cpc > 0 else None
    avg_cvr = kpi.cvr if kpi.cvr is not None else 0.0
    avg_rev_per_conv = safe_div(kpi.revenue, kpi.conversions) or 0.0

    expected_clicks = budget / avg_cpc if avg_cpc else 0.0
    expected_conversions = expected_clicks * avg_cvr
    expected_revenue = expected_conversions * avg_rev_per_conv
    expected_roas = safe_div(expected_revenue, budget)

    return ForecastResponse(
        model_name="baseline_ratio_model",
        expected_clicks=expected_clicks,
        expected_conversions=expected_conversions,
        expected_revenue=expected_revenue,
        expected_roas=expected_roas,
    )
