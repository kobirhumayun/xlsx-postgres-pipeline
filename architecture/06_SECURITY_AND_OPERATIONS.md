# Security And Operations

## Trust Model

This app is designed for a trusted single user or operator.

The implementation does not include:

- Login
- Role-based access control
- Per-user permissions
- CSRF protection
- SQL policy enforcement

Do not expose the app publicly without an external access-control layer such as
a VPN, reverse proxy auth, private network, or equivalent deployment control.

## Raw SQL Capability

Raw SQL execution is intentional.

Operational impact:

- `SELECT` and `WITH` queries are previewed through a cursor.
- Other SQL is executed directly.
- DDL and DML can create, modify, or delete data.
- Database permissions are controlled by the PostgreSQL user in `DATABASE_URL`.

Use a least-privilege database user if the app should be restricted.

## Database Credentials

Database credentials are read from server-side environment variables.

Client pages call internal API routes and do not receive the database connection
string directly.

## Database Selection

The app can connect to multiple databases by rewriting the database name in the
base `DATABASE_URL`.

Operational impact:

- The same host, port, username, password, and connection options are reused.
- The selected database must allow the configured user to connect.
- API callers can submit `databaseName`; use network/auth controls if that is a concern.

## Query Limits

Preview row count is controlled by:

```bash
QUERY_PREVIEW_LIMIT=1000
```

There is no documented statement timeout in the final code. If long-running
queries are a concern, configure PostgreSQL-level limits or add route-level
timeouts in a future code change.

## Import Limits

The import route streams workbook rows on the server, but the UI also reads the
workbook to inspect headers. Very large files can still affect browser or server
memory. Use operator judgment for file size until explicit upload limits are
implemented.
