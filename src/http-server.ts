#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GmailService } from "./services/gmail.service.js";
import { PostgresService } from "./services/postgres.service.js";

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

class MCPHTTPServer {
  private app: express.Application;
  private gmailService: GmailService;
  private postgresService: PostgresService;

  constructor() {
    this.app = express();
    this.gmailService = new GmailService();
    this.postgresService = new PostgresService();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS for all origins (configure as needed for production)
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // MCP SSE endpoint
    this.app.get("/sse", async (req: Request, res: Response) => {
      console.log("[MCP] New SSE connection established");

      const transport = new SSEServerTransport("/message", res);
      const server = this.createMCPServer();

      await server.connect(transport);

      // Handle client disconnect
      req.on("close", () => {
        console.log("[MCP] SSE connection closed");
      });
    });

    // MCP message endpoint for SSE
    this.app.post("/message", async (req: Request, res: Response) => {
      console.log("[MCP] Received message:", JSON.stringify(req.body, null, 2));

      // The SSE transport will handle this
      res.status(200).json({ received: true });
    });

    // Info endpoint
    this.app.get("/", (_req: Request, res: Response) => {
      res.json({
        name: "MCP Gmail & PostgreSQL Server",
        version: "1.0.0",
        transport: "SSE",
        endpoints: {
          health: "/health",
          sse: "/sse",
          message: "/message",
        },
        tools: [
          "gmail_list_emails",
          "gmail_read_email",
          "gmail_send_email",
          "gmail_get_labels",
          "postgres_query",
          "postgres_execute",
          "postgres_get_tables",
          "postgres_get_table_schema",
        ],
      });
    });
  }

  private createMCPServer(): Server {
    const server = new Server(
      {
        name: "mcp-gmail-postgres-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const gmailTools = await this.gmailService.getTools();
      const postgresTools = await this.postgresService.getTools();

      return {
        tools: [...gmailTools, ...postgresTools],
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const typedArgs = (args || {}) as Record<string, unknown>;

      console.log(`[MCP] Tool call: ${name}`, typedArgs);

      // Route to appropriate service
      if (name.startsWith("gmail_")) {
        return await this.gmailService.handleTool(name, typedArgs);
      } else if (name.startsWith("postgres_")) {
        return await this.postgresService.handleTool(name, typedArgs);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "gmail://inbox",
            name: "Gmail Inbox",
            mimeType: "application/json",
            description: "Access to Gmail inbox",
          },
          {
            uri: "postgres://connection",
            name: "PostgreSQL Connection",
            mimeType: "application/json",
            description: "PostgreSQL database connection status",
          },
        ],
      };
    });

    // Read resources
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri.startsWith("gmail://")) {
        return await this.gmailService.readResource(uri);
      } else if (uri.startsWith("postgres://")) {
        return await this.postgresService.readResource(uri);
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }
    });

    // Error handling
    server.onerror = (error: Error) => {
      console.error("[MCP Error]", error);
    };

    return server;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(PORT, HOST, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  MCP Gmail & PostgreSQL Server (HTTP Mode)                ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Host: ${HOST.padEnd(50)}║
║  Port: ${PORT.toString().padEnd(50)}║
║                                                            ║
║  Endpoints:                                                ║
║    • Info:    http://${HOST}:${PORT}/                    ║
║    • Health:  http://${HOST}:${PORT}/health              ║
║    • SSE:     http://${HOST}:${PORT}/sse                 ║
║                                                            ║
║  For n8n, use: http://${HOST}:${PORT}/sse                ║
╚════════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });
  }

  async cleanup(): Promise<void> {
    await this.postgresService.cleanup();
    await this.gmailService.cleanup();
  }
}

// Start server
const server = new MCPHTTPServer();

server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await server.cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await server.cleanup();
  process.exit(0);
});
