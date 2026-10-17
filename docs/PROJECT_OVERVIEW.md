# Purpose and scope

MiniShop keeps a family convenience store's sales, stock, and customer credit in one local system. Amounts use Philippine pesos; business dates use Asia/Manila. The authoritative database sits beside the backend. Once dependencies have been downloaded and the application built, ordinary operation uses no external internet services, fonts, CDNs, or authentication provider. The shop computer and LAN must remain available; there is no disconnected-device sales queue.

## Implemented features

| Area | Behavior |
| --- | --- |
| Dashboard | Today's net sales, completed transaction count, stock and expiry watch, outstanding credit, recent sales, seven-day chart |
| Products | Categories, SKU/barcode uniqueness, search, category/status filters, create/edit/deactivate, default cost, selling price, unit, threshold |
| Inventory | Receiving, signed owner adjustments with reason, batch costs/expiry, immutable movement history, nonnegative stock |
| Cashier | Keyboard barcode entry, search, cart, whole-piece and three-decimal weighted quantities, owner discounts, cash/change, customer credit |
| Checkout | Server prices, decimal line rounding, atomic sale/payment/stock/credit/audit, transaction lock, actor-bound request idempotency |
| Sales | Date/reference search, pagination, cashier-specific history, unique references, owner-only full reversal with reason |
| Customers | Named accounts, optional contact, owner credit limits/status, append-only charges/payments/refunds, oldest-debt repayment allocation |
| Receipts | PDF download, browser thermal print at 58 or 80 mm, store details/footer, itemized quantities, cash/change/credit |
| Employees | Owner/Cashier roles, Identity password hashing, login/logout, lockout/rate limiting, deactivate/reactivate, password resets, session revocation |
| Reports | Date ranges for day/week/month, sales trend, batch-cost gross profit estimates, product performance, current valuation, credit/sales/inventory CSV |

## Boundaries and next work

- This is a tested local release candidate, not a claim of production readiness or tax approval. Complete real-shop acceptance, a qualified security/deployment review, and a BIR invoicing review before commercial use. Sales slips are explicitly labeled as non-official invoices. No legal compliance determination has been made.
- Full sale reversals are supported; partial line refunds, exchanges, supplier returns, damaged-goods quarantine, cash drawer shifts, expenses, net profit, purchase orders, promotions, VAT/accounting, and direct printer drivers are future work. Returned quantities go back to the original batches; inspect them and record a negative adjustment if unsellable. Expired batches remain unavailable at checkout.
- Money has two decimal places; product quantities have three. Gram and kilogram products use separate configured units; automatic gram/kg conversion and fractional-cent unit prices are not implemented. A product's unit cannot change after receiving any stock.
- The whole-shop PostgreSQL transaction lock favors correctness and simplicity over high write throughput. It is intended for a small single-store workload. All future commerce writers must take this lock. More stores require store-scoped locks, stronger scoping of data, and capacity tests.
- The interface has a light theme. Product/sales/movement/audit lists are paginated; category/customer selectors and batch/ledger lists have documented caps (200 matching product options, 500 customers/batches/ledger entries). Narrow product/customer searches for larger catalogs; implement server-side selector pagination and full historical-ledger export before operating at larger scale.
- PDFs use built-in Helvetica and ASCII transliteration. Unicode scripts outside that font become `?`; browser thermal receipts preserve Unicode. Add an embedded licensed Unicode font before relying on downloaded PDFs for names using unsupported scripts.
- Store settings and customer display names are current values when an old receipt is viewed. Item names, prices, unit, costs, cashier name, and monetary totals are sale snapshots. Add an immutable receipt-identity snapshot if archival/legal requirements call for it.
- Browser checkout/repayment recovery uses session storage in the same browser tab. Closing that tab can discard its recovery key. If a response is uncertain, keep the tab open and retry; if it is lost, reconcile Sales History/customer ledger before entering another transaction. Ordinary unsent cart changes are not saved.
- Hardware scanner compatibility is keyboard-wedge entry plus Enter. Real thermal printer paper/cutter behavior, multi-device LAN access, power loss, long-running load, and off-site disaster recovery still need on-site acceptance. Cloud synchronization is designed only in documentation.

## Required tools and what was available

The implementation was checked on Windows with .NET SDK 10.0.401/runtime 10.0.12, Node 24.11.1, npm 11.6.2, Git 2.52.0, PostgreSQL 18.6, and locally installed Playwright Chromium. PostgreSQL binaries were outside PATH. Docker and uv were absent. Python's WindowsApps interpreter was inaccessible, and Poppler was unavailable; PDF verification used local Node PDF.js/canvas instead. These tools are not needed to run the app. All dependencies are version-pinned in the project/lock files.

Use a **fresh empty production database** without demo seeding. Never treat the current fictional demonstration/E2E transactions as actual shop records.
