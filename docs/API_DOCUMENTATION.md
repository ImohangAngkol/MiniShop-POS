# REST API reference

Base path: `/api`. JSON uses camelCase. All routes except health, CSRF bootstrap, and login require authentication. API routes return 401/403 rather than HTML login redirects. OpenAPI JSON is at `/openapi/v1.json` in Development and requires a signed-in session.

For mutations: GET `/api/auth/csrf`, keep its cookie, send the response `token` in `X-CSRF-TOKEN`. POST login with that token and credentials; then fetch a new CSRF token because identity changed. Use cookie credentials and the same origin. There is no registration, bearer token, or wildcard CORS endpoint. Logout and every other write also require CSRF.

| Method / route | Permission | Body / behavior |
| --- | --- | --- |
| GET /health | Public | Database readiness, 200 or 503 |
| GET /auth/csrf | Public | `{token}` + antiforgery cookie |
| POST /auth/login | Public, rate limited | `{email,password}` → id/email/displayName/roles + session cookie |
| GET /auth/me | Signed in | Current employee id/email/displayName/roles |
| POST /auth/logout | Signed in | Revokes current browser cookie |
| GET /categories | Signed in | Ordered category array |
| POST /categories | Owner | `{name}` → category |
| GET /products | Signed in | `search,categoryId,includeInactive,page,pageSize` → `{items,total,page,pageSize}`; max size 200 |
| GET /products/scan | Signed in | Required `code` (1–80 chars); exact active barcode/SKU lookup, independent of category/paging; 404 unknown, 409 ambiguous; cashier cost remains null |
| POST /products | Owner | Product body below → `{id}` |
| PUT /products/{id} | Owner | Same product body; 204 |
| DELETE /products/{id} | Owner | Soft deactivation; 204 |
| GET /inventory/batches | Owner | Optional productId; latest 500 batches |
| GET /inventory/movements | Owner | Optional productId and page; latest-first 100 per page |
| POST /inventory/receive | Owner | `{productId,quantity,unitCost,expiresOn,reference}` → batch id/quantity |
| POST /inventory/adjust | Owner | `{batchId,quantity,reason}`; quantity is signed change |
| POST /sales | Signed in | Checkout body below → sale and item snapshots |
| GET /sales | Signed in | `from,to,search,page` → `{total,items}`; 50 per page; cashiers see only own sales |
| GET /sales/{id} | Own sale or Owner | Sale/item/receipt data; other cashier's sale is forbidden |
| GET /sales/{id}/pdf | Own sale or Owner | `application/pdf` attachment; optional `paperWidth=58` or `80` overrides only this PDF's layout, never stored settings |
| POST /sales/{id}/refund | Owner | `{reason}`; full idempotent reversal → sale |
| GET /customers | Signed in | Optional search; first 500 ordered matches, includes balance |
| POST /customers | Signed in | `{name,contact,creditLimit,active}`; cashier must use null limit and active=true |
| PUT /customers/{id} | Owner | Same body; preserves history |
| GET /customers/{id}/ledger | Signed in | `{balance,items}`; last 500 entries |
| POST /customers/{id}/repayments | Signed in | `{requestId,amount}` → payment id/amount/current balance |
| GET /employees | Owner | Employee profile/roles/status; no hashes/passwords |
| POST /employees | Owner | `{email,displayName,password,role}`; role Owner or Cashier |
| PUT /employees/{id}/status | Owner | `{active}`; cannot change own status |
| PUT /employees/{id}/password | Owner | `{password}`; revokes previous sessions |
| GET /settings | Signed in | Current store/receipt settings and demo marker |
| PUT /settings | Owner | `{storeName,contact,address,receiptFooter,thermalWidthMm}`; width 58 or 80 |
| GET /settings/audit | Owner | `page`; 100 immutable entries per page |
| GET /reports/dashboard | Owner | Today/trend, credit, low stock, expiry, recent transactions |
| GET /reports/sales | Owner | `from,to` inclusive PHT dates; revenue, profit, cost, refunds, collections, daily/product totals |
| GET /reports/inventory | Owner | Current batch-cost valuation, expired valuation, product totals |
| GET /reports/export/{kind} | Owner | kind sales/credit/inventory, optional from/to; downloadable UTF-8 CSV |
| GET /admin/development-progress | Owner | Private reviewed progress JSON; no-store; missing/unreadable/malformed file returns 503; Cashier 403, anonymous 401 |

Product body example (fictional):

```json
{"name":"Jasmine Rice","sku":"RICE-001","barcode":null,"categoryId":1,"unit":"kilogram","costPrice":48.00,"sellingPrice":58.63,"lowStockThreshold":5.000,"active":true}
```

Checkout body example:

```json
{"requestId":"6d901c4f-e1be-4d26-bb90-98bfd224fb83","items":[{"productId":1,"quantity":1.125}],"discount":0,"cashReceived":20.00,"customerId":1,"onCredit":true}
```

Use a new UUID for each new operation. For a retry, resend the **identical JSON data and UUID under the same employee account**. Reusing a checkout key with a different payload or actor returns 409. A completed duplicate returns its original sale, including its current refund status. Repayments use the same key/amount/customer/actor rule. Cash sale and repayment request ids share the Payments unique-key space; never reuse keys across operations.

Sale response includes `id,reference,cashierId,cashierName,customerId,customerName,createdAt,subtotal,discount,total,cashReceived,cashApplied,change,credit,status,refundedAt,refundReason,refundCash,items`. `credit` is credit at the original sale; use the ledger for the current balance. Checkout responses can omit a customer display name if not loaded; receipt GET loads it. Product costs are null for cashiers; gross profit is owner-only.

Money inputs allow cents; quantity allows three decimals and only integers for pieces. A single sale subtotal and monetary input must be at most 99,999,999. Date ranges are limited to 367 inclusive days. Normal create operations return 200 with JSON; updates/deactivations often return 204. Failures use ProblemDetails with `title,status`, and validation may include `errors` keyed by field. Status meanings: 400 invalid input/CSRF, 401 no session, 403 insufficient role, 404 missing resource, 409 duplicate/conflicting key or stock/limit conflict, 429 login throttling, 500 unexpected server failure.

The current server enforces data annotations, service rules and database constraints independently of frontend validation. A network or 500 result is an uncertain outcome: retry the saved checkout/repayment key instead of assuming no sale/payment exists.
