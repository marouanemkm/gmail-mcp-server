import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
  ListEmailsArgs,
  ReadEmailArgs,
  SendEmailArgs,
  EmailData,
  GmailMessageFormat,
  GmailMessageItem,
  GmailHeader,
  GmailMessagePart,
} from "../types/gmail.types.js";

export class GmailService {
  private gmail: ReturnType<typeof google.gmail> | null = null;
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    this.initializeGmail();
  }

  private initializeGmail(): void {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || "urn:ietf:wg:oauth:2.0:oob";
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      console.warn("[Gmail] Client ID or Secret not configured");
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (refreshToken) {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    } else {
      console.warn("[Gmail] Refresh token not configured");
    }
  }

  async getTools(): Promise<Tool[]> {
    if (!this.gmail) {
      return [];
    }

    return [
      {
        name: "gmail_list_emails",
        description: "List emails from Gmail inbox. Can filter by query, maxResults, and labelIds.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: 'Search query string (e.g., "from:example@gmail.com subject:test")',
            },
            maxResults: {
              type: "number",
              description: "Maximum number of emails to return (default: 10)",
              default: 10,
            },
            labelIds: {
              type: "array",
              items: { type: "string" },
              description: 'Array of label IDs to filter by (e.g., ["INBOX", "UNREAD"])',
            },
          },
        },
      },
      {
        name: "gmail_read_email",
        description: "Read a specific email by its message ID",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "The ID of the email message to read",
            },
            format: {
              type: "string",
              enum: ["full", "metadata", "minimal", "raw"],
              description: "Format of the email response (default: full)",
              default: "full",
            },
          },
          required: ["messageId"],
        },
      },
      {
        name: "gmail_send_email",
        description: "Send an email via Gmail",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "Recipient email address",
            },
            subject: {
              type: "string",
              description: "Email subject",
            },
            body: {
              type: "string",
              description: "Email body (plain text)",
            },
            htmlBody: {
              type: "string",
              description: "Email body (HTML, optional)",
            },
            cc: {
              type: "string",
              description: "CC email address (optional)",
            },
            bcc: {
              type: "string",
              description: "BCC email address (optional)",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_get_labels",
        description: "Get list of all Gmail labels",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];
  }

  async handleTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.gmail) {
      throw new Error("Gmail service not initialized. Please check your Gmail credentials.");
    }

    try {
      switch (name) {
        case "gmail_list_emails":
          return await this.listEmails(args as unknown as ListEmailsArgs);
        case "gmail_read_email":
          return await this.readEmail(args as unknown as ReadEmailArgs);
        case "gmail_send_email":
          return await this.sendEmail(args as unknown as SendEmailArgs);
        case "gmail_get_labels":
          return await this.getLabels();
        default:
          throw new Error(`Unknown Gmail tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Gmail operation failed: ${errorMessage}`);
    }
  }

  private async listEmails(args: ListEmailsArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, maxResults = 10, labelIds } = args;

    const response = await this.gmail!.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
      labelIds,
    });

    const messages = response.data.messages || [];
    const emailList = messages.map((msg: GmailMessageItem) => ({
      id: msg.id || null,
      threadId: msg.threadId || null,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(emailList, null, 2),
        },
      ],
    };
  }

  private async readEmail(args: ReadEmailArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { messageId, format = "full" } = args;

    const response = await this.gmail!.users.messages.get({
      userId: "me",
      id: messageId,
      format: format as GmailMessageFormat,
    });

    const message = response.data;
    const emailData: EmailData = {
      id: message.id || null,
      threadId: message.threadId || null,
      labelIds: message.labelIds || null,
      snippet: message.snippet || null,
    };

    // Parse headers
    if (message.payload?.headers) {
      const headers: Record<string, string> = {};
      message.payload.headers.forEach((header: GmailHeader) => {
        if (header.name && header.value) {
          headers[header.name.toLowerCase()] = header.value;
        }
      });
      emailData.headers = headers;
    }

    // Extract body
    if (message.payload?.body?.data) {
      emailData.body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    } else if (message.payload?.parts) {
      const bodyParts: string[] = [];
      message.payload.parts.forEach((part: GmailMessagePart) => {
        if (part.body?.data) {
          bodyParts.push(Buffer.from(part.body.data, "base64").toString("utf-8"));
        }
      });
      emailData.body = bodyParts.join("\n---\n");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(emailData, null, 2),
        },
      ],
    };
  }

  private async sendEmail(args: SendEmailArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { to, subject, body, htmlBody, cc, bcc } = args;

    const toLine = `To: ${to}`;
    const ccLine = cc ? `Cc: ${cc}` : "";
    const bccLine = bcc ? `Bcc: ${bcc}` : "";
    const subjectLine = `Subject: ${subject}`;
    const contentType = htmlBody ? "text/html" : "text/plain";
    const emailBody = htmlBody || body;

    const rawMessage = [toLine, ccLine, bccLine, subjectLine, `Content-Type: ${contentType}; charset=utf-8`, "", emailBody]
      .filter((line) => line !== "")
      .join("\r\n");

    const encodedMessage = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const response = await this.gmail!.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              messageId: response.data.id,
              threadId: response.data.threadId,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getLabels(): Promise<{ content: Array<{ type: string; text: string }> }> {
    const response = await this.gmail!.users.labels.list({
      userId: "me",
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data.labels || [], null, 2),
        },
      ],
    };
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
    if (uri === "gmail://inbox") {
      const emails = await this.listEmails({ maxResults: 20 });
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: emails.content[0].text,
          },
        ],
      };
    }
    throw new Error(`Unknown Gmail resource: ${uri}`);
  }

  async cleanup(): Promise<void> {
    // Cleanup if needed
  }
}
