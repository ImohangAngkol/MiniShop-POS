# Owner and cashier manual

## Open the shop

Start PostgreSQL and the application as described in SETUP_GUIDE. Open the local shop URL and sign in. The first generated owner password is kept in the private `.runtime/local-env.ps1` file. Give each worker their own account under Employees so cashier history and audit entries identify the correct person. Deactivate an account when someone leaves; do not share the owner login.

A development banner means the database includes fictional demonstration records. Use a new empty operational database before real shop use.

## Set up products and stock

1. Owners open Products, add a category, and choose Add product.
2. Enter a recognizable name, unique SKU, optional unique barcode, category, unit, price and low-stock threshold. Prices are per configured unit. For example, rice sold in kilograms uses a price per kilogram and a 1.125 quantity for 1,125 grams.
3. Open Stock receiving, choose the product, and enter delivery reference, quantity, actual unit cost and optional expiry. Receiving creates a new batch; it does not erase an older one.
4. Inventory shows on-hand batches and a signed movement history. For a count correction, choose Adjust and enter the change (for example `-2` for two damaged pieces), with a meaningful reason. A negative final batch quantity is rejected.

Low-stock uses unexpired available stock. Expired stock remains visible for counting/disposal but cannot be sold. Stock expiry is evaluated in Philippine time, through the end of the date printed on the batch. Check local shop policy if goods should be withdrawn earlier and use stock adjustments accordingly.

Deactivating a product keeps historical sales. Its unit cannot change after receiving stock; create a new product if packaging/unit changes. Default cost is a receiving convenience/reference; each batch has its own actual cost.

## Make a sale

Open Point of sale. Focus the barcode box and scan with a keyboard-compatible scanner ending in Enter, or type a product name/SKU and select a product. Tap plus/minus or edit the quantity. Pieces require whole numbers; grams/kilograms allow three decimals.

The cart shows subtotal and total. Owners can enter a fixed peso discount; cashiers cannot authorize discounts. Enter cash received. The app displays change when cash exceeds the total. Click Complete sale once and wait for the receipt.

The server rechecks current product prices and available stock. If a product price changed while the cart was open, the confirmed receipt is authoritative. Do not hand over change until checkout is confirmed and the receipt reviewed.

Before checkout, Clear cart cancels the unsent order. After checkout, an owner must use a controlled refund. Financial records are retained.

## Sell on utang

Create/select an active named customer, enter any cash paid now, and enable “Record remaining amount as utang.” The remaining amount is checked against the customer's configured limit. A limit is optional; only owners can set/change it. Cashiers may create active customer accounts without a configured limit.

Open Utang accounts to see outstanding balances. Choose Ledger for charges, repayments and refund entries. Choose Repay, enter the amount received, and confirm. Partial and full repayments are supported; an overpayment is rejected. Repayments settle the oldest open sales first. They are cash collections and do not create new sales revenue.

## Interrupted checkout/payment

If the network response is lost, keep the tab open. The screen pauses edits and offers Retry saved checkout (or payment). Restore the shop server/LAN and retry. It sends the original key, so a sale already recorded returns its result instead of being recorded again. Reloading the **same tab** also recovers a pending checkout/payment.

Do not close an uncertain tab or start a new order to “try again.” If the tab was closed or storage was cleared, inspect Sales History/customer ledger and reconcile stock/cash before manually re-entering anything. There is no disconnected-device checkout mode.

## Receipts and refunds

After a sale, download PDF or choose Print receipt. Settings select 58/80 mm thermal width, store name/contact/address and footer. In the print dialog choose matching paper, 100% scale, and disable browser headers/footers. Preview before printing. Printer drivers and physical cutting must be tested with your printer.

These are sales slips, clearly marked as not official invoices. Obtain a qualified review of invoicing requirements before commercial use. Downloaded PDFs transliterate accented Latin characters; unsupported Unicode becomes `?`. Browser thermal printing preserves the actual text.

In Sales History, owners can reverse a completed sale with a reason. This is a **full reversal**, restoring original batch quantities and retaining the original record. Inspect returned goods and remove unsellable stock with a reasoned adjustment. Outstanding credit for that sale is reversed. Money already paid (including allocated credit repayments) is the cash refund. Open the refunded receipt and use its Cash refund amount; do not assume it equals original cash received. Repeating the same full refund does not refund twice.

## Reports and daily close

Dashboard shows sales less refunds recognized today, completed transactions, stock/expiry alerts, credit and recent activity. Reports offers today, last seven days, month-to-date and custom dates. Compare sales, cost of goods and gross profit estimates. Cash sales, credit repayments and cash refunds are separate. Expenses and net profit are not tracked.

CSV exports cover sales, current inventory and outstanding credit. A sales CSV lists original sale and refund details; use the displayed report's event-date logic when reconciling periods. Run a database backup at daily close, verify it periodically, and copy it to encrypted separate storage. Check actual cash against collections/refunds using your own opening-float record; cash drawer shift accounting is not built in.

Sign out and close the browser on a shared machine. Stop the app cleanly before planned shutdown and allow PostgreSQL to stop normally. A UPS is recommended for a shop PC but was not installed or tested in this project.
