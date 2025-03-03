#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as mysql from 'mysql2/promise';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('host', {
    type: 'string',
    description: 'MySQL host',
    default: 'localhost',
  })
  .option('port', {
    type: 'number',
    description: 'MySQL port',
    default: 3306,
  })
  .option('user', {
    type: 'string',
    description: 'MySQL username',
    default: 'root',
  })
  .option('password', {
    type: 'string',
    description: 'MySQL password',
    default: '',
  })
  .option('database', {
    type: 'string',
    description: 'MySQL database name',
    demandOption: true,
  })
  .help()
  .alias('help', 'h').argv as any;

// Business insights storage
interface Insight {
  id: number;
  content: string;
  timestamp: Date;
}

class MySQLServer {
  private server: Server;
  private pool: mysql.Pool;
  private insights: Insight[] = [];
  private insightCounter = 0;

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

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'mcp-server-mysql',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.pool.end();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'memo://insights',
          name: 'Business Insights Memo',
          mimeType: 'text/plain',
          description: 'A continuously updated memo of business insights discovered during analysis',
        },
      ],
    }));

    // No resource templates for this server
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => ({
        resourceTemplates: [],
      })
    );

    // Handle resource reading
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
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
            contents: [
              {
                uri: request.params.uri,
                mimeType: 'text/plain',
                text: memoText,
              },
            ],
          };
        }

        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown resource: ${request.params.uri}`
        );
      }
    );
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(rows, null, 2),
                },
              ],
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
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ affected_rows: (result as any).affectedRows }, null, 2),
                },
              ],
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
              content: [
                {
                  type: 'text',
                  text: 'Table created successfully',
                },
              ],
            };
          }

          case 'list_tables': {
            const [rows] = await this.pool.query(
              'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
              [argv.database]
            );

            const tables = (rows as any[]).map((row) => row.table_name || row.TABLE_NAME);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(tables, null, 2),
                },
              ],
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
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(rows, null, 2),
                },
              ],
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
              content: [
                {
                  type: 'text',
                  text: `Insight #${newInsight.id} added to memo`,
                },
              ],
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
          content: [
            {
              type: 'text',
              text: `Error: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    try {
      // Test database connection
      const connection = await this.pool.getConnection();
      connection.release();
      console.error(`Connected to MySQL database: ${argv.database}`);

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('MySQL MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start MySQL MCP server:', error);
      process.exit(1);
    }
  }
}

const server = new MySQLServer();
server.run().catch(console.error);
