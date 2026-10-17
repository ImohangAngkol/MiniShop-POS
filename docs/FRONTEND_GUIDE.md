# React frontend guide

The frontend lives in `src/minishop-web`. React and TypeScript describe the interface, Vite builds it, Tailwind is available through its Vite plugin, and custom CSS implements the responsive purple/orange design. Local system fonts and CSS illustrations avoid runtime internet dependencies.

## Components and routes

`App.tsx` loads `/auth/me`, then shows login or the authenticated shell. The shell contains the desktop sidebar, mobile navigation drawer, workspace header, and routed page content. Owner-only routes redirect cashiers to the POS; the server separately enforces the same permissions. Hiding a link is not an authorization control.

Pages are loaded with `React.lazy` and `Suspense`, so the charting code is not downloaded before a cashier needs it. React Router handles navigation. The ASP.NET fallback returns index.html for non-API application routes, while unknown API routes remain 404.

`ui.tsx` provides labeled validated forms, native modal dialogs, tables, badges, notifications, loading/error handling and empty states. A dialog's native `showModal()` provides keyboard focus containment and Escape handling. Form inputs have explicit accessible names and links to their error/hint text. `readability.css` increases text contrast and cashier control sizes. Reduced-motion settings are respected. No placeholder revenue or sales are shown as real records.

## Server state and mutations

TanStack Query stores fetched server state. `useData<T>(path)` uses the API path as its query key. Searches, dates, filters and pagination change that key, causing the correct fetch. `useAction` manages mutation pending/error/success states and refreshes queries after a confirmed write. Mutations never auto-retry.

`api.ts` centralizes Axios, same-origin credentials, CSRF token handling and user-friendly problem messages. Mutating requests include `X-CSRF-TOKEN`. After login, the token is refreshed for the newly authenticated identity. A 401 from a protected request clears private query data and the displayed session. Logout cancels outstanding queries, updates the observed session entry to null, and removes other cached data. The session entry itself is retained so its active observer receives the change; a browser test caught why removing the entire cache first could leave an old observer displaying a signed-in shell.

React Hook Form manages form values and error state. Zod supplies field validators, including required/nonblank input, email/password shape, and numerical ranges. Values are converted to numeric JSON fields at request construction. ASP.NET revalidates all requests; browser validation is for usability, not data protection.

## POS preview and recovery

`format.ts` uses decimal.js for line-total previews rather than JavaScript binary float addition. The server repeats authoritative decimal calculations using current prices. Weighted quantity is in the configured product unit. Keyboard scanners fill the search box and send Enter, adding an exact SKU/barcode or sole match. Alphanumeric barcode search is case-insensitive at the API.

Checkout writes an intent (request UUID, payload, cart preview) to **session storage before sending**. Editing pauses while a committed result is uncertain. Retry sends the identical data; reloading the same tab restores it. Deterministic validation/authorization/stock conflicts release the form for correction. An unknown network/500 result retains the request, preventing accidental new checkout keys. The response-loss E2E test actually commits the sale, aborts its browser response, reloads, retries, and checks a single stock movement.

Repayment dialogs also retain request id and amount in session storage across dialog reopening/reload. A browser tab's session storage may disappear when the tab closes; operators must reconcile uncertain operations before entering them again. Do not use local storage for session passwords or authentication tokens.

## Charts, receipts, and export

Recharts displays daily sales and product reports using API aggregates. No external chart service is used. `ReceiptPage` uses semantic HTML and print CSS to hide app chrome and lay out a 58/80 mm sales slip. Download links request authenticated PDF/CSV routes from the same origin. CSV is produced server-side with text formula-injection protection.

Use `npm.cmd --prefix src/minishop-web run dev` for hot reload. `run build` first runs strict TypeScript checking, then creates `dist`. `scripts/Build.ps1` places that output in API `wwwroot`. Vitest/React Testing Library cover decimal totals and form behavior; Playwright covers the built app against the real API. `npm.cmd --prefix src/minishop-web exec -- prettier --check 'src/**/*.{ts,tsx,css}'` can check formatting when run from the web project directory (or use its local prettier executable).
