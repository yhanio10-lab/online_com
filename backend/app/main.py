from datetime import date
from typing import Literal, Optional

from fastapi import FastAPI, Query

from .schemas import AdMetricIn, ForecastRequest
from .services import aggregate_kpis, baseline_forecast

app = FastAPI(title="Ad Analytics MVP API", version="0.1.0")

DATA_STORE: list[AdMetricIn] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/uploads")
def upload_metrics(payload: list[AdMetricIn]) -> dict[str, int]:
    DATA_STORE.extend(payload)
    return {"uploaded": len(payload), "total": len(DATA_STORE)}


@app.get("/api/dashboard/kpis")
def dashboard_kpis(
    start: Optional[date] = None,
    end: Optional[date] = None,
    channel: Optional[str] = None,
) -> dict:
    rows = _filtered_rows(start=start, end=end, channel=channel)
    return aggregate_kpis(rows).model_dump()


@app.get("/api/dashboard/timeseries")
def dashboard_timeseries(
    metric: Literal["impressions", "clicks", "cost", "conversions", "revenue", "ctr", "cvr", "roas"] = Query("roas"),
    channel: Optional[str] = None,
) -> list[dict]:
    rows = _filtered_rows(channel=channel)
    grouped: dict[date, list[AdMetricIn]] = {}
    for row in rows:
        grouped.setdefault(row.date, []).append(row)

    response: list[dict] = []
    for day in sorted(grouped.keys()):
        k = aggregate_kpis(grouped[day])
        if metric == "impressions":
            value = k.impressions
        elif metric == "clicks":
            value = k.clicks
        elif metric == "cost":
            value = k.cost
        elif metric == "conversions":
            value = k.conversions
        elif metric == "revenue":
            value = k.revenue
        elif metric == "ctr":
            value = k.ctr
        elif metric == "cvr":
            value = k.cvr
        else:
            value = k.roas

        response.append({"date": day.isoformat(), "metric": metric, "value": value})

    return response


@app.post("/api/forecast")
def forecast(payload: ForecastRequest) -> dict:
    rows = _filtered_rows(channel=payload.channel)
    if payload.campaign:
        rows = [r for r in rows if r.campaign == payload.campaign]

    result = baseline_forecast(rows, budget=payload.budget)
    return result.model_dump()


def _filtered_rows(
    start: Optional[date] = None,
    end: Optional[date] = None,
    channel: Optional[str] = None,
) -> list[AdMetricIn]:
    rows = DATA_STORE
    if start is not None:
        rows = [r for r in rows if r.date >= start]
    if end is not None:
        rows = [r for r in rows if r.date <= end]
    if channel:
        rows = [r for r in rows if r.channel == channel]
    return rows
