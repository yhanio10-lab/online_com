# API명세서

## 공통 응답

성공:

```json
{
  "ok": true,
  "data": {}
}
```

실패:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "message",
    "details": {}
  }
}
```

## SKU 매핑

### GET /api/mapping/options

옵션 목록 조회.

Query:

```text
platform
status
q
page
size
```

status:

```text
mapped
unmapped
conflict
```

### GET /api/sku/search

SKU 검색.

Query:

```text
q
size
```

검색 규칙:
- 공백 기준 토큰 분리
- 모든 토큰을 만족해야 한다
- 검색 대상은 SKU 코드, 품목명, 규격, 바코드

예:

```text
/api/sku/search?q=프릭션 0.5 블랙&size=200
```

### POST /api/mapping

매핑 생성.

Body:

```json
{
  "platform": "smartstore",
  "product_option_id": 1,
  "sku_code": "A100001",
  "created_by": "admin-ui",
  "reason": "admin-ui"
}
```

검증:
- SKU 존재
- SKU 활성
- 동일 옵션 활성 매핑 없음

### POST /api/mapping/bulk

매핑 일괄 생성.

Body:

```json
{
  "created_by": "admin-ui",
  "items": [
    {
      "platform": "smartstore",
      "product_option_id": 1,
      "sku_code": "A100001"
    }
  ]
}
```

### PUT /api/mapping/{id}

매핑 수정.

Body:

```json
{
  "sku_code": "A100002",
  "changed_by": "admin-ui",
  "reason": "admin-ui"
}
```

### DELETE /api/mapping/{id}

매핑 비활성 처리.

## 충돌

### GET /api/mapping/conflicts

충돌 옵션 목록 조회.

충돌 조건:
- 동일 옵션에 활성 매핑 2개 이상
- SKU가 존재하지 않음
- SKU가 비활성
- 옵션 플랫폼과 매핑 플랫폼 불일치

## 세트/번들

### GET /api/bundles

세트 SKU 목록 조회.

Query:

```text
q
page
size
```

### GET /api/bundles/{skuCode}

세트 SKU 상세 조회.

### POST /api/bundles/{skuCode}/components

구성품 추가.

Body:

```json
{
  "component_sku_code": "A100001",
  "component_quantity": 2
}
```

### PUT /api/bundles/{skuCode}/components/{componentId}

구성품 수량 수정.

Body:

```json
{
  "component_quantity": 3,
  "is_active": true
}
```

### DELETE /api/bundles/{skuCode}/components/{componentId}

구성품 비활성 처리.

### GET /api/bundles/{skuCode}/availability

세트 가용재고 조회.

## 매출

### POST /api/sales/ingest

주문 원천 데이터 수집.

### GET /api/sales/summary

SKU 기준 매출 집계.

Query:

```text
from
to
groupBy
```

## 재고

### GET /api/inventory/summary

SKU 기준 재고 조회.

Query:

```text
sku
```
