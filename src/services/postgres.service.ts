import { Pool, type QueryResult } from 'pg';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  QueryArgs,
  GetTablesArgs,
  GetTableSchemaArgs,
  QueryResponse,
  ExecuteResponse,
} from '../types/postgres.types.js';

export class PostgresService {
  private pool: Pool | null = null;

  constructor() {
    this.initializePostgres();
  }

  private initializePostgres(): void {
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const database = process.env.POSTGRES_DATABASE || 'postgres';
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD;

    if (!password) {
      console.warn('[PostgreSQL] Password not configured');
      return;
    }

    this.pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    this.pool.query('SELECT NOW()').catch((error) => {
      console.error('[PostgreSQL] Connection test failed:', error.message);
    });
  }

  async getTools(): Promise<Tool[]> {
    if (!this.pool) {
      return [];
    }

    return [
      {
        name: 'postgres_query',
        description: 'Execute a SELECT query on PostgreSQL database. Returns read-only results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL SELECT query to execute',
            },
            params: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional parameters for parameterized query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'postgres_execute',
        description: 'Execute a write operation (INSERT, UPDATE, DELETE) on PostgreSQL database.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute (INSERT, UPDATE, DELETE)',
            },
            params: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional parameters for parameterized query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'postgres_get_tables',
        description: 'Get list of all tables in the database',
        inputSchema: {
          type: 'object',
          properties: {
            schema: {
              type: 'string',
              description: 'Schema name (default: public)',
              default: 'public',
            },
          },
        },
      },
      {
        name: 'postgres_get_table_schema',
        description: 'Get schema information for a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table',
            },
            schema: {
              type: 'string',
              description: 'Schema name (default: public)',
              default: 'public',
            },
          },
          required: ['tableName'],
        },
      },
    ];
  }

  async handleTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.pool) {
      throw new Error('PostgreSQL service not initialized. Please check your database credentials.');
    }

    try {
      switch (name) {
        case 'postgres_query':
          return await this.query(args as unknown as QueryArgs);
        case 'postgres_execute':
          return await this.execute(args as unknown as QueryArgs);
        case 'postgres_get_tables':
          return await this.getTables(args as unknown as GetTablesArgs);
        case 'postgres_get_table_schema':
          return await this.getTableSchema(args as unknown as GetTableSchemaArgs);
        default:
          throw new Error(`Unknown PostgreSQL tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`PostgreSQL operation failed: ${errorMessage}`);
    }
  }

  private async query(args: QueryArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, params = [] } = args;

    // Security check: Only allow SELECT queries
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new Error('postgres_query only accepts SELECT queries. Use postgres_execute for write operations.');
    }

    const result: QueryResult = await this.pool!.query(query, params);

    const response: QueryResponse = {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((field) => ({
        name: field.name,
        dataTypeID: field.dataTypeID,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async execute(args: QueryArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, params = [] } = args;

    const trimmedQuery = query.trim().toUpperCase();
    if (trimmedQuery.startsWith('SELECT')) {
      throw new Error('postgres_execute is for write operations. Use postgres_query for SELECT queries.');
    }

    const result: QueryResult = await this.pool!.query(query, params);

    const response: ExecuteResponse = {
      success: true,
      rowCount: result.rowCount,
      command: result.command,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async getTables(args: GetTablesArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { schema = 'public' } = args;

    const query = `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name;
    `;

    const result = await this.pool!.query(query, [schema]);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  }

  private async getTableSchema(args: GetTableSchemaArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { tableName, schema = 'public' } = args;

    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const result = await this.pool!.query(query, [schema, tableName]);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
    if (uri === 'postgres://connection') {
      const isConnected = this.pool !== null;
      let status = 'disconnected';

      if (isConnected) {
        try {
          await this.pool!.query('SELECT 1');
          status = 'connected';
        } catch (error) {
          status = 'error';
        }
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                status,
                database: process.env.POSTGRES_DATABASE || 'postgres',
                host: process.env.POSTGRES_HOST || 'localhost',
              },
              null,
              2
            ),
          },
        ],
      };
    }
    throw new Error(`Unknown PostgreSQL resource: ${uri}`);
  }

  async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

