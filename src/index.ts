#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { GmailService } from './services/gmail.service.js';
import { PostgresService } from './services/postgres.service.js';

// Load environment variables
dotenv.config();

class MCPServer {
  private server: Server;
  private gmailService: GmailService;
  private postgresService: PostgresService;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-gmail-postgres-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize services
    this.gmailService = new GmailService();
    this.postgresService = new PostgresService();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const gmailTools = await this.gmailService.getTools();
      const postgresTools = await this.postgresService.getTools();

      return {
        tools: [...gmailTools, ...postgresTools],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const typedArgs = args as Record<string, unknown>;

      // Route to appropriate service
      if (name.startsWith('gmail_')) {
        return await this.gmailService.handleTool(name, typedArgs);
      } else if (name.startsWith('postgres_')) {
        return await this.postgresService.handleTool(name, typedArgs);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'gmail://inbox',
            name: 'Gmail Inbox',
            mimeType: 'application/json',
            description: 'Access to Gmail inbox',
          },
          {
            uri: 'postgres://connection',
            name: 'PostgreSQL Connection',
            mimeType: 'application/json',
            description: 'PostgreSQL database connection status',
          },
        ],
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri.startsWith('gmail://')) {
        return await this.gmailService.readResource(uri);
      } else if (uri.startsWith('postgres://')) {
        return await this.postgresService.readResource(uri);
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    await this.postgresService.cleanup();
    await this.gmailService.cleanup();
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Gmail & PostgreSQL Server running on stdio');
  }
}

// Start server
const server = new MCPServer();
server.run().catch(console.error);

