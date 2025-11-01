# Quick Start Guide - n8n Integration

## ✅ Your MCP Server is Ready!

The server is currently running at: **`http://localhost:3000`**

## 🔌 Connect to n8n in 3 Steps

### Step 1: Open n8n

Go to your n8n instance (local or cloud)

### Step 2: Add MCP Client to AI Agent

1. Create a new workflow or open an existing one
2. Add an **AI Agent** node
3. In the AI Agent, add a **Tool** → **MCP Client**
4. Configure the MCP Client with these settings:

```
Endpoint: http://localhost:3000/sse
Server Transport: HTTP Streamable
Authentication: None
Tools to Include: All
```

**Important**: The endpoint must be `http://localhost:3000/sse` (note the `/sse` path!)

### Step 3: Test It!

In your AI Agent node, try prompts like:
- "List my recent emails"
- "Show me all database tables"
- "Send an email to test@example.com with subject 'Test' and body 'Hello'"

## 📋 Available Tools

Your agent now has access to 8 tools:

**Gmail** (4 tools):
- `gmail_list_emails` - Search and list emails
- `gmail_read_email` - Read email content  
- `gmail_send_email` - Send emails
- `gmail_get_labels` - List all labels

**PostgreSQL** (4 tools):
- `postgres_query` - Run SELECT queries
- `postgres_execute` - Run INSERT/UPDATE/DELETE
- `postgres_get_tables` - List all tables
- `postgres_get_table_schema` - Get table structure

## 🌐 Deploy to VPS (for Remote Access)

If n8n is on a different machine or VPS, you need to deploy the server:

### Quick VPS Deployment

1. **Copy to VPS:**
```bash
scp -r dist package.json .env your-user@your-vps:/opt/mcp-server/
```

2. **Install on VPS:**
```bash
ssh your-user@your-vps
cd /opt/mcp-server
npm install --production
```

3. **Update .env:**
```bash
nano .env
# Change HOST=0.0.0.0 to listen on all interfaces
```

4. **Open firewall:**
```bash
sudo ufw allow 3000/tcp
```

5. **Run with PM2:**
```bash
npm install -g pm2
pm2 start npm --name "mcp-server" -- run start:http
pm2 save
pm2 startup
```

6. **In n8n, use:**
```
Endpoint: http://your-vps-ip:3000/sse
```

## 🔧 Configuration

### Already Configured (.env file):
- Gmail API credentials
- PostgreSQL connection  
- Server host and port

### Need to Change Settings?

Edit `.env` file:
```bash
# For local use
HOST=localhost
PORT=3000

# For VPS/remote use
HOST=0.0.0.0  # Listen on all interfaces
PORT=3000
```

Restart server after changes:
```bash
# Kill current server (Ctrl+C if in foreground)
npm run start:http
```

## ✅ Verify Server is Running

Test endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Server info (shows all available tools)
curl http://localhost:3000/

# Expected response:
{
  "name": "MCP Gmail & PostgreSQL Server",
  "version": "1.0.0",
  "transport": "SSE",
  "endpoints": {
    "health": "/health",
    "sse": "/sse",
    "message": "/message"
  },
  "tools": [...]
}
```

## 🐛 Troubleshooting

### n8n Can't Connect

**Check server is running:**
```bash
curl http://localhost:3000/health
```

**Check n8n can reach the server:**
- If n8n is on same machine: use `http://localhost:3000/sse`
- If n8n is remote: use `http://your-server-ip:3000/sse`
- Make sure firewall allows port 3000

### "Gmail service not initialized"

Your Gmail credentials in `.env` may be missing or invalid:
```bash
# Check .env file has:
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...

# Generate new refresh token if needed:
node scripts/get-gmail-token.js
```

### "PostgreSQL service not initialized"

Your database credentials in `.env` may be incorrect:
```bash
# Check .env file has:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=your_db
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# Test connection:
psql -h localhost -U your_user -d your_db
```

## 📖 Full Documentation

- **[N8N_SETUP.md](N8N_SETUP.md)** - Complete n8n integration guide
- **[README.md](README.md)** - Full server documentation
- **[TESTING.md](TESTING.md)** - Testing guide (if created)

## 🎉 You're All Set!

Your MCP server is ready to use with n8n. Start building powerful AI workflows with Gmail and PostgreSQL access!

## Example n8n Workflow

Try this simple workflow:

1. **Manual Trigger** → Start workflow
2. **AI Agent** (with your MCP Client configured) → Process request
3. **Set** → Format output

In the AI Agent, try: *"List my 5 most recent emails and show me their subjects"*

The agent will use the `gmail_list_emails` tool automatically! 🎯

