#!/usr/bin/env node
import * as mysql from 'mysql2/promise';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as readline from 'readline';
import { createInterface } from 'readline';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
function validateEnv() {
  const requiredVars = ['DB_CONNECTION', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Error: Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease create a .env file with these variables. See .env.example for reference.');
    process.exit(1);
  }

  // Validate DB_CONNECTION is mysql
  if (process.env.DB_CONNECTION !== 'mysql') {
    console.error('Error: DB_CONNECTION must be set to "mysql"');
    console.error('Please check your .env file and set DB_CONNECTION=mysql');
    process.exit(1);
  }
}

// Parse command line arguments (as fallback to .env)
const argv = yargs(hideBin(process.argv))
  .option('host', {
    type: 'string',
    description: 'MySQL host',
    default: process.env.DB_HOST || 'localhost',
  })
  .option('port', {
    type: 'number',
    description: 'MySQL port',
    default: parseInt(process.env.DB_PORT || '3306'),
  })
  .option('user', {
    type: 'string',
    description: 'MySQL username',
    default: process.env.DB_USER,
  })
  .option('password', {
    type: 'string',
    description: 'MySQL password',
    default: process.env.DB_PASSWORD,
  })
  .option('database', {
    type: 'string',
    description: 'MySQL database name',
    default: process.env.DB_NAME,
  })
  .help()
  .alias('help', 'h').argv as any;

// Validate environment variables
validateEnv();

// Error codes
enum ErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

// Custom error class
class McpError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'McpError';
  }
}

// Business insights storage
interface Insight {
  id: number;
  content: string;
  timestamp: Date;
}

// MCP message types
interface McpRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params: any;
}

interface McpResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

class MySQLServer {
  private pool: mysql.Pool;
  private insights: Insight[] = [];
  private insightCounter = 0;
  private rl: readline.Interface;

  constructor() {
    // Create MySQL connection pool
    this.pool = mysql.createPool({
      host: argv.host,
      port: argv.port,
      user: argv.user,
      password: argv.password,
      database: argv.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Create readline interface for stdin/stdout
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Handle SIGINT
    process.on('SIGINT', async () => {
      await this.pool.end();
      process.exit(0);
    });
  }

  // Handle MCP requests
  private async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.method) {
        case 'mcp.listTools':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                {
                  name: 'read_query',
                  description: 'Execute a SELECT query to read data from the database',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The SELECT SQL query to execute',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'write_query',
                  description: 'Execute an INSERT, UPDATE, or DELETE query',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The SQL modification query',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'create_table',
                  description: 'Create a new table in the database',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The CREATE TABLE SQL statement',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'list_tables',
                  description: 'Get a list of all tables in the database',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                  },
                },
                {
                  name: 'describe_table',
                  description: 'View schema information for a specific table',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      table_name: {
                        type: 'string',
                        description: 'Name of table to describe',
                      },
                    },
                    required: ['table_name'],
                  },
                },
                {
                  name: 'append_insight',
                  description: 'Add a new business insight to the memo',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      insight: {
                        type: 'string',
                        description: 'Business insight discovered from data analysis',
                      },
                    },
                    required: ['insight'],
                  },
                },
              ],
            },
          };

        case 'mcp.listResources':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              resources: [
                {
                  uri: 'memo://insights',
                  name: 'Business Insights Memo',
                  mimeType: 'text/plain',
                  description: 'A continuously updated memo of business insights discovered during analysis',
                },
              ],
            },
          };

        case 'mcp.listResourceTemplates':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              resourceTemplates: [],
            },
          };

        case 'mcp.readResource':
          if (request.params.uri === 'memo://insights') {
            // Generate insights memo
            let memoText = '# Business Insights Memo\n\n';

            if (this.insights.length === 0) {
              memoText += 'No insights have been discovered yet.\n';
            } else {
              this.insights.forEach((insight) => {
                memoText += `## Insight ${insight.id}\n`;
                memoText += `*${insight.timestamp.toISOString()}*\n\n`;
                memoText += `${insight.content}\n\n`;
              });
            }

            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                contents: [
                  {
                    uri: request.params.uri,
                    mimeType: 'text/plain',
                    text: memoText,
                  },
                ],
              },
            };
          } else {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Unknown resource: ${request.params.uri}`
            );
          }

        case 'mcp.callTool':
          return await this.handleToolCall(request);

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown method: ${request.method}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }

      console.error('Error handling request:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: ErrorCode.InternalError,
          message: (error as Error).message,
        },
      };
    }
  }

  // Handle tool calls
  private async handleToolCall(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.params.name) {
        case 'read_query': {
          const { query } = request.params.arguments as { query: string };

          // Validate that this is a SELECT query
          if (!query.trim().toLowerCase().startsWith('select')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Only SELECT queries are allowed with read_query'
            );
          }

          const [rows] = await this.pool.query(query);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(rows, null, 2),
                },
              ],
            },
          };
        }

        case 'write_query': {
          const { query } = request.params.arguments as { query: string };

          // Validate that this is not a SELECT query
          if (query.trim().toLowerCase().startsWith('select')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'SELECT queries are not allowed with write_query, use read_query instead'
            );
          }

          const [result] = await this.pool.query(query);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ affected_rows: (result as any).affectedRows }, null, 2),
                },
              ],
            },
          };
        }

        case 'create_table': {
          const { query } = request.params.arguments as { query: string };

          // Validate that this is a CREATE TABLE query
          if (!query.trim().toLowerCase().startsWith('create table')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Only CREATE TABLE statements are allowed with create_table'
            );
          }

          await this.pool.query(query);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: 'Table created successfully',
                },
              ],
            },
          };
        }

        case 'list_tables': {
          const [rows] = await this.pool.query(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
            [argv.database]
          );

          const tables = (rows as any[]).map((row) => row.table_name || row.TABLE_NAME);

          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(tables, null, 2),
                },
              ],
            },
          };
        }

        case 'describe_table': {
          const { table_name } = request.params.arguments as { table_name: string };

          const [rows] = await this.pool.query(
            'SELECT column_name, data_type, is_nullable, column_default ' +
            'FROM information_schema.columns ' +
            'WHERE table_schema = ? AND table_name = ?',
            [argv.database, table_name]
          );

          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(rows, null, 2),
                },
              ],
            },
          };
        }

        case 'append_insight': {
          const { insight } = request.params.arguments as { insight: string };

          this.insightCounter++;
          const newInsight: Insight = {
            id: this.insightCounter,
            content: insight,
            timestamp: new Date(),
          };

          this.insights.push(newInsight);

          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Insight #${newInsight.id} added to memo`,
                },
              ],
            },
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      console.error('Error executing tool:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${(error as Error).message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  // Start the server
  async run() {
    try {
      // Test database connection
      const connection = await this.pool.getConnection();
      connection.release();
      console.error(`Connected to MySQL database: ${argv.database}`);

      // Start reading from stdin
      this.rl.on('line', async (line) => {
        try {
          // Parse the request
          const request = JSON.parse(line) as McpRequest;
          
          // Handle the request
          const response = await this.handleRequest(request);
          
          // Send the response
          console.log(JSON.stringify(response));
        } catch (error) {
          console.error('Error processing request:', error);
          
          // Send error response
          const response: McpResponse = {
            jsonrpc: '2.0',
            id: 'unknown',
            error: {
              code: ErrorCode.ParseError,
              message: (error as Error).message,
            },
          };
          
          console.log(JSON.stringify(response));
        }
      });

      console.error('MySQL MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start MySQL MCP server:', error);
      process.exit(1);
    }
  }
}

const server = new MySQLServer();
server.run().catch(console.error);
