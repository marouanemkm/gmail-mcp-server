# MCP Gmail & PostgreSQL Server

A unified Model Context Protocol (MCP) server that provides AI agents with read and write access to Gmail and PostgreSQL databases.

## Features

- **Gmail Integration**: Send emails, read emails, list emails, and manage labels
- **PostgreSQL Integration**: Execute queries, read/write operations, and schema inspection
- **Modular Architecture**: Cleanly separated services for easy maintenance
- **Environment-based Configuration**: Secure credential management via `.env` file

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Gmail API credentials (Google Cloud Console)
- PostgreSQL database

## Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Build the project:**

```bash
npm run build
```

## Configuration

### Step 1: Create `.env` file

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

### Step 2: Configure Gmail

#### Get Gmail API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as application type
   - Download the credentials JSON file

5. Get your Client ID and Client Secret from the credentials

6. Get a Refresh Token:
   - Run this script to authorize and get a refresh token:
   ```bash
   node scripts/get-gmail-token.js
   ```
   - Or use Google's OAuth 2.0 Playground:
     1. Go to https://developers.google.com/oauthplayground/
     2. Click the gear icon (⚙️) and check "Use your own OAuth credentials"
     3. Enter your Client ID and Client Secret
     4. In the left panel, select "Gmail API v1" and check the scopes:
        - `https://www.googleapis.com/auth/gmail.readonly`
        - `https://www.googleapis.com/auth/gmail.send`
        - `https://www.googleapis.com/auth/gmail.modify`
     5. Click "Authorize APIs" and sign in
     6. Click "Exchange authorization code for tokens"
     7. Copy the "Refresh token" value

7. Add to `.env`:
```env
GMAIL_CLIENT_ID=your_client_id_from_step_5
GMAIL_CLIENT_SECRET=your_client_secret_from_step_5
GMAIL_REFRESH_TOKEN=your_refresh_token_from_step_6
```

### Step 3: Configure PostgreSQL

Add your PostgreSQL connection details to `.env`:

```env
POSTGRES_HOST=localhost          # or your database host
POSTGRES_PORT=5432               # default PostgreSQL port
POSTGRES_DATABASE=your_db_name   # your database name
POSTGRES_USER=your_db_user       # your database user
POSTGRES_PASSWORD=your_password  # your database password
POSTGRES_SSL=false               # set to true if using SSL
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server runs on stdio and communicates via JSON-RPC, following the MCP protocol.

## Available Tools

### Gmail Tools

- **`gmail_list_emails`**: List emails from inbox with optional filters
  - Parameters: `query`, `maxResults`, `labelIds`
  
- **`gmail_read_email`**: Read a specific email by message ID
  - Parameters: `messageId`, `format`
  
- **`gmail_send_email`**: Send an email
  - Parameters: `to`, `subject`, `body`, `htmlBody` (optional), `cc` (optional), `bcc` (optional)
  
- **`gmail_get_labels`**: Get all Gmail labels

### PostgreSQL Tools

- **`postgres_query`**: Execute SELECT queries (read-only)
  - Parameters: `query`, `params` (optional array)
  
- **`postgres_execute`**: Execute write operations (INSERT, UPDATE, DELETE)
  - Parameters: `query`, `params` (optional array)
  
- **`postgres_get_tables`**: List all tables in the database
  - Parameters: `schema` (optional, default: 'public')
  
- **`postgres_get_table_schema`**: Get schema information for a table
  - Parameters: `tableName`, `schema` (optional, default: 'public')

## Deployment to VPS

1. **Transfer files to your VPS:**
```bash
scp -r . user@your-vps-ip:/path/to/mcp-server/
```

2. **SSH into your VPS and install:**
```bash
ssh user@your-vps-ip
cd /path/to/mcp-server
npm install
npm run build
```

3. **Create `.env` file on VPS** with your credentials

4. **Run as a service (using PM2 or systemd):**

With PM2:
```bash
npm install -g pm2
pm2 start npm --name "mcp-server" -- start
pm2 save
```

With systemd, create `/etc/systemd/system/mcp-server.service`:
```ini
[Unit]
Description=MCP Gmail & PostgreSQL Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/mcp-server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable mcp-server
sudo systemctl start mcp-server
```

## Project Structure

```
.
├── src/
│   ├── index.ts              # Main server entry point
│   └── services/
│       ├── gmail.service.ts  # Gmail integration
│       └── postgres.service.ts # PostgreSQL integration
├── dist/                     # Compiled JavaScript
├── .env                      # Environment variables (not in git)
├── .env.example             # Example environment file
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

- Never commit `.env` file to version control
- Use strong database passwords
- Keep Gmail OAuth credentials secure
- Consider using environment-specific credentials for production
- Regularly rotate refresh tokens and passwords

## Troubleshooting

### Gmail not working
- Verify your refresh token is valid and not expired
- Check that all required OAuth scopes are granted
- Ensure `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are correct

### PostgreSQL connection issues
- Verify database credentials are correct
- Check if PostgreSQL is running and accessible
- For remote connections, ensure firewall rules allow connections
- If using SSL, set `POSTGRES_SSL=true` in `.env`

## License

MIT

