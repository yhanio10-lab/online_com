from datetime import date

from app.schemas import AdMetricIn
from app.services import aggregate_kpis, baseline_forecast, safe_div


def test_safe_div_zero_returns_none():
    assert safe_div(10, 0) is None


def test_aggregate_kpis_basic():
    rows = [
        AdMetricIn(
            date=date(2026, 3, 1),
            channel="google",
            campaign="c1",
            impressions=100,
            clicks=10,
            cost=10000,
            conversions=2,
            revenue=30000,
        ),
        AdMetricIn(
            date=date(2026, 3, 2),
            channel="google",
            campaign="c1",
            impressions=200,
            clicks=20,
            cost=20000,
            conversions=4,
            revenue=60000,
        ),
    ]

    k = aggregate_kpis(rows)
    assert k.impressions == 300
    assert k.clicks == 30
    assert k.conversions == 6
    assert round(k.ctr, 4) == 0.1
    assert round(k.cpa, 2) == 5000


def test_baseline_forecast_returns_positive_values():
    rows = [
        AdMetricIn(
            date=date(2026, 3, 1),
            channel="meta",
            campaign="c2",
            impressions=1000,
            clicks=50,
            cost=50000,
            conversions=5,
            revenue=150000,
        )
    ]

    result = baseline_forecast(rows, budget=100000)
    assert result.expected_clicks > 0
    assert result.expected_conversions > 0
    assert result.expected_revenue > 0
