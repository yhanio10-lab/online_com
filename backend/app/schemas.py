from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AdMetricIn(BaseModel):
    date: date
    channel: str
    campaign: str
    adgroup: Optional[str] = None
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)
    cost: float = Field(ge=0)
    conversions: int = Field(ge=0)
    revenue: float = Field(ge=0)


class KPIResponse(BaseModel):
    impressions: int
    clicks: int
    cost: float
    conversions: int
    revenue: float
    ctr: Optional[float]
    cpc: Optional[float]
    cvr: Optional[float]
    cpa: Optional[float]
    roas: Optional[float]


class ForecastRequest(BaseModel):
    budget: float = Field(gt=0)
    channel: Optional[str] = None
    campaign: Optional[str] = None


class ForecastResponse(BaseModel):
    model_name: Literal["baseline_ratio_model"]
    expected_clicks: float
    expected_conversions: float
    expected_revenue: float
    expected_roas: Optional[float]
