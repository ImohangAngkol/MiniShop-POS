using Npgsql;

namespace MiniShop.Api.Data;

/// <summary>Explicit grants: a new table gets no runtime access until reviewed here.</summary>
public static class RuntimeDatabasePolicy
{
    public static readonly string[] AppendOnlyTables = ["StockMovements", "CreditTransactions", "AuditLogs", "Payments", "Discounts", "SaleItems", "Allocations"];
    private static string Quote(string value) => new NpgsqlCommandBuilder().QuoteIdentifier(value);

    // Run as the migration/schema owner, never from the running web application.
    public static async Task ApplyAsync(string ownerConnection, string runtimeRole)
    {
        await using var connection = new NpgsqlConnection(ownerConnection);
        await connection.OpenAsync();
        var role = Quote(runtimeRole);
        var database = Quote(connection.Database);
        var sql = $"""
            REVOKE ALL ON DATABASE {database} FROM PUBLIC;
            GRANT CONNECT ON DATABASE {database} TO {role};
            REVOKE ALL ON SCHEMA public FROM PUBLIC;
            GRANT USAGE ON SCHEMA public TO {role};
            REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role};
            REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role};
            REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
            ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO {role};
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role};
            GRANT INSERT, UPDATE ON "Products", "Categories", "Batches", "Customers", "Settings", "AspNetUsers" TO {role};
            GRANT INSERT, UPDATE, DELETE ON "AspNetUserClaims", "AspNetUserLogins", "AspNetUserRoles", "AspNetUserTokens" TO {role};
            GRANT INSERT ON "Sales", {string.Join(", ", AppendOnlyTables.Select(Quote))} TO {role};
            GRANT UPDATE ("Status", "RefundedAt", "RefundReason", "RefundCash") ON "Sales" TO {role};
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    public static async Task VerifyAsync(string runtimeConnection)
    {
        await using var connection = new NpgsqlConnection(runtimeConnection);
        await connection.OpenAsync();
        const string sql = """
            SELECT NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
              AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
              AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
              AND NOT has_database_privilege(current_user, current_database(), 'TEMP')
              AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
                  AND (nspowner = r.oid OR has_schema_privilege(current_user, oid, 'CREATE')))
              AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relowner = r.oid)
              AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datdba = r.oid)
              AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
                  AND has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename), 'TRUNCATE,REFERENCES,TRIGGER'))
              AND NOT has_table_privilege(current_user, '"__EFMigrationsHistory"', 'INSERT,UPDATE,DELETE')
              AND NOT has_column_privilege(current_user, '"Sales"', 'Total', 'UPDATE')
              AND NOT has_table_privilege(current_user, '"Sales"', 'DELETE')
            FROM pg_roles r WHERE rolname = current_user;
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        if (await command.ExecuteScalarAsync() is not true)
            throw new InvalidOperationException("Runtime database role has elevated privileges. Run staging provisioning with the migration identity; do not start the web app as an administrator.");
        foreach (var table in AppendOnlyTables)
        {
            await using var check = new NpgsqlCommand("SELECT has_table_privilege(current_user, @table, 'UPDATE,DELETE') OR has_any_column_privilege(current_user, @table, 'UPDATE')", connection);
            check.Parameters.AddWithValue("table", Quote(table));
            if (await check.ExecuteScalarAsync() is true) throw new InvalidOperationException("Runtime ledger permissions are elevated.");
        }
    }
}
