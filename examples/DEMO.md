# MySQL MCP Server Demo

This demo shows how to use the MySQL MCP server with Claude to interact with a MySQL database. Follow these steps to set up the demo environment and see the MCP server in action.

## Setup

### 1. Create the Demo Database

Run the provided SQL script to create a sample database with tables and data:

```bash
# Option 1: Using the mysql command line client
mysql -u your_username -p < examples/sql/setup.sql

# Option 2: Using a MySQL client of your choice
# Simply open and run the examples/sql/setup.sql file
```

This will create:
- A `mcp_demo` database
- Tables for `customers`, `products`, `orders`, and `order_items`
- Sample data in all tables
- Views for `order_summary` and `product_sales`

### 2. Configure the MCP Server

Update your `cline_mcp_settings.json` file to include the MySQL MCP server:

```json
"mcpServers": {
  "mysql": {
    "command": "node",
    "args": [
      "/path/to/zaj_MySQL_MCP/build/index.js",
      "--host", "localhost",
      "--port", "3306",
      "--user", "your_username",
      "--password", "your_password",
      "--database", "mcp_demo"
    ],
    "disabled": false,
    "autoApprove": []
  }
}
```

Replace:
- `/path/to/zaj_MySQL_MCP/build/index.js` with the actual path to the built index.js file
- `your_username` and `your_password` with your MySQL credentials

## Example Usage with Claude

Here are some examples of how to interact with the MySQL database through Claude:

### Exploring the Database Schema

**You**: "What tables are available in the database?"

**Claude**: *Claude will use the `list_tables` tool to retrieve the list of tables*

```
Tables in the database:
- customers
- products
- orders
- order_items
- order_summary (view)
- product_sales (view)
```

**You**: "Show me the structure of the customers table."

**Claude**: *Claude will use the `describe_table` tool to get the schema*

```
Customers table structure:
- customer_id: INT (Primary Key, Auto Increment)
- first_name: VARCHAR(50) (Not Null)
- last_name: VARCHAR(50) (Not Null)
- email: VARCHAR(100) (Not Null, Unique)
- phone: VARCHAR(20)
- created_at: TIMESTAMP (Default: CURRENT_TIMESTAMP)
```

### Querying Data

**You**: "Show me all customers in the database."

**Claude**: *Claude will use the `read_query` tool to execute a SELECT query*

```
Found 5 customers:
1. John Doe (john.doe@example.com)
2. Jane Smith (jane.smith@example.com)
3. Robert Johnson (robert.johnson@example.com)
4. Emily Williams (emily.williams@example.com)
5. Michael Brown (michael.brown@example.com)
```

**You**: "What are the top-selling product categories?"

**Claude**: *Claude will use the `read_query` tool to execute a more complex query*

```
Top-selling categories by revenue:
1. Electronics: $2,399.97
2. Furniture: $249.99
3. Kitchen Appliances: $169.98
```

### Modifying Data

**You**: "Add a new customer named Alex Johnson with email alex.johnson@example.com and phone 555-111-2222."

**Claude**: *Claude will use the `write_query` tool to execute an INSERT query*

```
Customer added successfully.
Affected rows: 1
```

**You**: "Update the stock quantity for the Laptop product, reducing it by 1."

**Claude**: *Claude will use the `write_query` tool to execute an UPDATE query*

```
Stock updated successfully.
Affected rows: 1
```

### Business Intelligence

**You**: "Analyze the sales data and provide insights."

**Claude**: *Claude will use multiple queries and the `append_insight` tool*

```
Based on my analysis of the sales data, I've identified the following insights:

1. Electronics is the highest-revenue category, accounting for 85% of total sales.
2. The Laptop product has the highest average order value.
3. John Doe is the customer with the highest total purchase amount.
4. 75% of orders have been either delivered or shipped.

These insights have been added to the business insights memo.
```

## Advanced Usage

You can ask Claude to perform more complex operations, such as:

- Creating new tables
- Performing joins across multiple tables
- Generating reports with aggregated data
- Identifying trends and patterns in the data
- Suggesting database optimizations

The MySQL MCP server enables Claude to act as a powerful database analyst and administrator, helping you extract value from your MySQL databases.
