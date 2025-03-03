-- MySQL MCP Server Demo Setup
-- This script creates a sample database with tables and data for demonstrating the MySQL MCP server

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS mcp_demo;

-- Use the demo database
USE mcp_demo;

-- Create a customers table
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create a products table
CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create an orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
) ENGINE=InnoDB;

-- Create an order_items table
CREATE TABLE IF NOT EXISTS order_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB;

-- Insert sample customers
INSERT INTO customers (first_name, last_name, email, phone) VALUES
('John', 'Doe', 'john.doe@example.com', '555-123-4567'),
('Jane', 'Smith', 'jane.smith@example.com', '555-987-6543'),
('Robert', 'Johnson', 'robert.johnson@example.com', '555-456-7890'),
('Emily', 'Williams', 'emily.williams@example.com', '555-789-0123'),
('Michael', 'Brown', 'michael.brown@example.com', '555-321-6540');

-- Insert sample products
INSERT INTO products (name, description, price, stock_quantity, category) VALUES
('Laptop', 'High-performance laptop with 16GB RAM and 512GB SSD', 1299.99, 25, 'Electronics'),
('Smartphone', 'Latest model with 128GB storage and dual camera', 899.99, 50, 'Electronics'),
('Coffee Maker', 'Programmable coffee maker with thermal carafe', 79.99, 30, 'Kitchen Appliances'),
('Running Shoes', 'Lightweight running shoes with cushioned sole', 129.99, 100, 'Footwear'),
('Desk Chair', 'Ergonomic office chair with lumbar support', 249.99, 15, 'Furniture'),
('Wireless Headphones', 'Noise-cancelling wireless headphones', 199.99, 40, 'Electronics'),
('Blender', 'High-speed blender for smoothies and soups', 89.99, 20, 'Kitchen Appliances'),
('Backpack', 'Water-resistant backpack with laptop compartment', 59.99, 35, 'Accessories');

-- Insert sample orders
INSERT INTO orders (customer_id, status, total_amount) VALUES
(1, 'delivered', 1299.99),
(2, 'shipped', 279.98),
(3, 'processing', 899.99),
(4, 'pending', 189.98),
(1, 'delivered', 249.99),
(5, 'cancelled', 59.99),
(2, 'delivered', 199.99),
(3, 'shipped', 219.98);

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 1299.99),
(2, 3, 1, 79.99),
(2, 5, 1, 199.99),
(3, 2, 1, 899.99),
(4, 6, 1, 199.99),
(4, 8, 1, 59.99),
(5, 5, 1, 249.99),
(6, 8, 1, 59.99),
(7, 6, 1, 199.99),
(8, 3, 1, 79.99),
(8, 7, 1, 89.99);

-- Create a view for order summaries
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.order_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    o.order_date,
    o.status,
    o.total_amount,
    COUNT(oi.item_id) AS total_items
FROM 
    orders o
JOIN 
    customers c ON o.customer_id = c.customer_id
JOIN 
    order_items oi ON o.order_id = oi.order_id
GROUP BY 
    o.order_id, customer_name, o.order_date, o.status, o.total_amount;

-- Create a view for product sales
CREATE OR REPLACE VIEW product_sales AS
SELECT 
    p.product_id,
    p.name AS product_name,
    p.category,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM 
    products p
JOIN 
    order_items oi ON p.product_id = oi.product_id
JOIN 
    orders o ON oi.order_id = o.order_id
WHERE 
    o.status != 'cancelled'
GROUP BY 
    p.product_id, product_name, p.category;

-- Sample queries to try with the MCP server:
-- 
-- 1. List all tables:
--    Tool: list_tables
--
-- 2. Describe the customers table:
--    Tool: describe_table
--    Arguments: { "table_name": "customers" }
--
-- 3. Get all customers:
--    Tool: read_query
--    Arguments: { "query": "SELECT * FROM customers" }
--
-- 4. Get order summary:
--    Tool: read_query
--    Arguments: { "query": "SELECT * FROM order_summary" }
--
-- 5. Get product sales by category:
--    Tool: read_query
--    Arguments: { "query": "SELECT category, SUM(total_revenue) AS revenue FROM product_sales GROUP BY category ORDER BY revenue DESC" }
--
-- 6. Add a new customer:
--    Tool: write_query
--    Arguments: { "query": "INSERT INTO customers (first_name, last_name, email, phone) VALUES ('Alex', 'Johnson', 'alex.johnson@example.com', '555-111-2222')" }
--
-- 7. Update product stock:
--    Tool: write_query
--    Arguments: { "query": "UPDATE products SET stock_quantity = stock_quantity - 1 WHERE product_id = 1" }
