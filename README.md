# MySQL MCP Server

An MCP server implementation that provides database interaction and business intelligence capabilities through MySQL. This server enables running SQL queries, analyzing business data, and automatically generating business insight memos.

## Features

- Execute SQL queries against a MySQL database
- Create and manage database tables
- Analyze database schema
- Generate and store business insights
- Access a continuously updated business insights memo

## Tools

### Query Tools

- **read_query**: Execute SELECT queries to read data from the database
  - Input: `query` (string) - The SELECT SQL query to execute
  - Returns: Query results as array of objects

- **write_query**: Execute INSERT, UPDATE, or DELETE queries
  - Input: `query` (string) - The SQL modification query
  - Returns: `{ affected_rows: number }`

- **create_table**: Create new tables in the database
  - Input: `query` (string) - CREATE TABLE SQL statement
  - Returns: Confirmation of table creation

### Schema Tools

- **list_tables**: Get a list of all tables in the database
  - No input required
  - Returns: Array of table names

- **describe_table**: View schema information for a specific table
  - Input: `table_name` (string) - Name of table to describe
  - Returns: Array of column definitions with names and types

### Analysis Tools

- **append_insight**: Add new business insights to the memo resource
  - Input: `insight` (string) - Business insight discovered from data analysis
  - Returns: Confirmation of insight addition
  - Triggers update of memo://insights resource

## Resources

The server exposes a single resource:

- **memo://insights**: A continuously updated business insights memo that aggregates discovered insights during analysis
  - Auto-updates as new insights are discovered via the append-insight tool

## Usage with Claude Desktop

Add the server to your `cline_mcp_settings.json`:

```json
"mcpServers": {
  "mysql": {
    "command": "node",
    "args": [
      "/path/to/mysql-server/build/index.js",
      "--host", "localhost",
      "--port", "3306",
      "--user", "your_mysql_username",
      "--password", "your_mysql_password",
      "--database", "your_database_name"
    ],
    "disabled": false,
    "autoApprove": []
  }
}
```

## Building

1. Install dependencies:
```bash
cd ~/Documents/Cline/MCP/mysql-server
npm install
```

2. Build the server:
```bash
npm run build
```

## License

This MCP server is licensed under the MIT License.
