# Vestov HUB MCP

The production Streamable HTTP endpoint is `https://vestov-cp-prod.onrender.com/api/mcp`.
It serves administrator-only read tools for clients, projects, assignments, team members,
time entries, leave, reimbursements, invoices, finance dashboard totals, ledger entries and payroll.
List results include `nextAfterId`. Pass it back as `afterId` with the same filters until it is null.

## Render configuration

Create a `vh_mcp_` token with 32 random bytes encoded as unpadded base64url.
Store the token in the client’s password manager. Configure these two environment variables
on the `vestov-cp-prod` service and deploy the changes.

- `VESTOV_MCP_TOKEN_SHA256` contains the hex SHA-256 digest of the full token, including the prefix.
- `VESTOV_MCP_ADMIN_EMAIL` contains the email of the active HUB administrator the connection uses.

The endpoint stays disabled without both values. Rotate the token by replacing the digest and
updating connected clients. Remove the digest or deactivate the administrator to revoke access.
The server logs the administrator ID and requested tool name.

## Connect Codex

For macOS, add a generic password to the login Keychain with service `vestov-hub-mcp`,
account set to the current macOS username, and password set to the MCP token. With server
dependencies installed, register the launcher using absolute paths to Node and the repository.

```sh
codex mcp add vestov-hub -- /absolute/path/to/node /absolute/path/to/server/scripts/codex-mcp.mjs
```

A client that already receives the token in its environment can connect directly.

```sh
codex mcp add vestov-hub --url https://vestov-cp-prod.onrender.com/api/mcp \
  --bearer-token-env-var VESTOV_MCP_TOKEN
```

Start a new Codex chat after registering the server so it discovers the tools.
