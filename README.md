# 광고 효율 분석/예측 서비스 개발 가이드 (MVP)

이 문서는 "광고 엑셀 업로드 → 성과표 계산 → 예측" 흐름을 **실제로 개발 시작**할 수 있도록 최소 실행 단위를 제공합니다.

## 1) 지금 포함된 것
- FastAPI 기반 백엔드 기본 서버
- 광고 데이터 업로드/조회/지표 계산 API
- 예산 기반 단순 예측 API(베이스라인)
- 지표 계산 유닛 테스트

## 2) 빠른 시작

### 요구사항
- Python 3.11+

### 설치 및 실행
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

실행 후 문서 확인:
- Swagger: http://localhost:8000/docs

## 3) API 흐름 (MVP)
1. `POST /api/uploads` 로 JSON 배열 업로드
2. `GET /api/dashboard/kpis` 로 KPI 요약 조회
3. `GET /api/dashboard/timeseries?metric=roas` 로 시계열 조회
4. `POST /api/forecast` 로 예산 기반 예측

## 4) 업로드 샘플(JSON)
```json
[
  {
    "date": "2026-03-01",
    "channel": "google",
    "campaign": "spring_sale",
    "adgroup": "brand",
    "impressions": 10000,
    "clicks": 450,
    "cost": 220000,
    "conversions": 32,
    "revenue": 780000
  }
]
```

## 5) 현재 예측 로직(베이스라인)
- 최근 데이터의 평균 CTR/CVR/CPC를 기반으로
- 입력 예산으로 클릭/전환/매출/ROAS를 단순 추정
- 이후 단계에서 Prophet/XGBoost로 교체 가능

## 6) 테스트
```bash
cd backend
pytest -q
```

## 7) 다음 개발 단계
- DB(PostgreSQL) 연동 및 업로드 영속화
- 엑셀(xlsx/csv) 파일 파싱 엔드포인트 추가
- Next.js 대시보드 UI 연결
- 모델 학습/평가 파이프라인 추가 (MAPE/RMSE 저장)
