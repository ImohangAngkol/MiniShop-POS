# A Python/React developer's guide to the C# backend

## The pieces you will recognize

Think of ASP.NET Core as the HTTP framework and `Program.cs` as application assembly, similar to creating a FastAPI app and registering its routers/dependencies. C# is compiled and statically typed. `dotnet build` catches type mismatches before the server starts. The `.csproj` resembles package/project metadata; the `.slnx` groups projects.

| C# concept | Useful Python comparison |
| --- | --- |
| `namespace MiniShop.Api.Services;` | A module/package boundary |
| `record CheckoutRequest(...)` | A typed immutable request dataclass, with validation attributes |
| `public sealed class Product` | A class that cannot be subclassed; public properties describe persisted fields |
| `string?` / `int?` | A value that may be null, like `str \| None` / `int \| None` |
| `Task<Sale>` / `async` / `await` | An asynchronous operation returning a Sale, similar to an async coroutine |
| `List<CartLine>` | A list whose elements must be CartLine instances |
| `[HttpPost]`, `[Authorize]` | Route/security metadata, analogous to framework decorators |
| `decimal` and `58.63m` | Exact base-10 decimal arithmetic, comparable to Python Decimal |
| `await using` | An async context manager that reliably disposes connections/transactions |
| `x => x.ProductId == id` | A typed lambda; EF translates eligible expressions into SQL |

`async` lets the server release a request thread while PostgreSQL is working; it does not make one EF context safe for simultaneous operations. A `ShopDb` belongs to one request/service scope. Tests simulate parallel requests using separate contexts.

## Follow one request through the code

The React cashier sends `POST /api/sales` with product ids, quantities, payment intent, and a UUID. It does **not** send an authoritative price. `SalesController.Checkout` receives the validated `CheckoutRequest`. Identity has already populated `User` from the authenticated cookie. The controller obtains the employee id/name, checks role context, and calls `CommerceService.Checkout`.

The service contains rules that should be true regardless of the caller: active products, sufficient unexpired stock, valid whole/fractional quantities, permitted discount, cash/credit requirements, and customer credit limit. It asks `ShopWriter.Run` to execute its work inside a transaction. `ShopWriter` acquires a PostgreSQL transaction-scoped advisory lock before commerce reads. The service mutates tracked batches and adds new sale/ledger objects. `SaveChangesAsync` turns those tracked changes into SQL. A single commit makes them visible together.

If a rule throws `BusinessException`, the transaction is disposed without committing. HTTP middleware returns a safe problem response with the intended 400/403/404/409 status. Unexpected exceptions are logged server-side and return a generic 500 plus a trace id. Credentials and detailed database values are not deliberately exposed to clients.

This separation keeps controllers small: HTTP routing and employee permissions belong there; accounting and stock correctness belong in services. Tests can exercise business rules directly with PostgreSQL and separately verify that the HTTP layer enforces authorization/CSRF.

## Dependency injection

The constructor `CommerceService(ShopDb db, ShopWriter writer)` declares dependencies. `Program.cs` registers them with `AddDbContext` and `AddScoped`. ASP.NET creates a fresh scoped object graph per request and disposes it afterward. You do not manually construct a database context in a controller.

`IReceiptRenderer` is an interface: callers depend on a contract rather than a particular PDF implementation. It is registered as a singleton because the implementation holds no mutable request state. Database services are scoped because the context tracks request-local changes. Avoid putting `ShopDb` into a singleton.

## Entities, DTOs, and database mapping

Entities describe durable records. DTOs describe allowed user input. They are separate so the browser cannot set a cashier identity, inject an item price, rewrite a balance, or choose an audit actor. `Responses.Sale` deliberately omits internal request hashes and cost snapshots from cashier responses. Owner product queries expose cost; cashier queries return null for it.

`ShopDb.OnModelCreating` defines relations, indexes and check constraints. PostgreSQL maps `decimal` to `numeric`, amounts to scale 2, and quantities to scale 3. EF uses parameterized queries. The only raw SQL commerce lock is a constant; no user string is interpolated into SQL syntax. Migrations are the versioned SQL change plan generated from this model, plus explicit ledger-protection triggers.

Identity is integrated through `IdentityDbContext<Employee>`. It owns users, roles, hashes, security stamps and login records. Do not implement your own password hashing or put password text into an Employee entity. Passwords are only transient DTO/config values passed to Identity's APIs.

## Changing the application safely

For a new checkout rule, first decide where it belongs in `CommerceService` and whether it changes the API contract. Add a meaningful rule/integration test, update DTOs/frontend validation if needed, then build/test. Schema changes require a new migration and a backup before applying it to an existing operational database.

`ShopWriter` is a correctness contract for every future stock/accounting writer. Bypassing it can reintroduce overselling even if the original checkout code is correct. Keep transactions short, avoid remote calls inside them, and keep printing after commit. Never retry an uncertain transaction under a new idempotency key.
