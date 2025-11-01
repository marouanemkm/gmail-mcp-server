import type { OAuth2Client } from 'google-auth-library';

export type GmailMessageFormat = 'full' | 'metadata' | 'minimal' | 'raw';

export interface ListEmailsArgs {
  query?: string;
  maxResults?: number;
  labelIds?: string[];
}

export interface ReadEmailArgs {
  messageId: string;
  format?: GmailMessageFormat;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  cc?: string;
  bcc?: string;
}

export interface EmailData {
  id?: string | null;
  threadId?: string | null;
  labelIds?: string[] | null;
  snippet?: string | null;
  headers?: Record<string, string>;
  body?: string;
}

export interface GmailMessageItem {
  id?: string | null;
  threadId?: string | null;
}

export interface GmailHeader {
  name?: string | null;
  value?: string | null;
}

export interface GmailMessagePart {
  body?: {
    data?: string | null;
  } | null;
}

export type GmailOAuth2Client = OAuth2Client;

