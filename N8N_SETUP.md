# Using MCP Server with n8n

This MCP server can be used with n8n's AI Agent node using the MCP Client connector.

## Quick Start

### 1. Configure Environment

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
# Gmail Configuration
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=your_database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# HTTP Server (for n8n)
HOST=0.0.0.0
PORT=3000
```

### 2. Start the HTTP Server

For local testing:
```bash
npm run dev:http
```

For production:
```bash
npm run build
npm run start:http
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║  MCP Gmail & PostgreSQL Server (HTTP Mode)                ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Host: 0.0.0.0                                             ║
║  Port: 3000                                                ║
║                                                            ║
║  For n8n, use: http://localhost:3000/sse                   ║
╚════════════════════════════════════════════════════════════╝
```

### 3. Configure n8n MCP Client

In your n8n workflow:

1. Add an **AI Agent** node
2. Add an **MCP Client** tool
3. Configure the MCP Client:

```
Endpoint: http://localhost:3000/sse
Server Transport: HTTP Streamable
Authentication: None
Tools to Include: All
```

**For screenshot reference**: The endpoint should be `http://localhost:3000/sse` (or your VPS URL)

### 4. Available Tools in n8n

Once connected, these tools will be available:

**Gmail Tools:**
- `gmail_list_emails` - List emails from inbox
- `gmail_read_email` - Read specific email by ID
- `gmail_send_email` - Send an email
- `gmail_get_labels` - Get all Gmail labels

**PostgreSQL Tools:**
- `postgres_query` - Execute SELECT queries
- `postgres_execute` - Execute INSERT/UPDATE/DELETE
- `postgres_get_tables` - List all database tables
- `postgres_get_table_schema` - Get table schema info

### 5. Test in n8n

Create a simple workflow:

1. **Manual Trigger** node
2. **AI Agent** node with:
   - Tool: MCP Client (configured above)
   - Prompt: "List my recent emails"
3. **Execute** the workflow

## Deploy to VPS for Remote Access

### Option 1: Direct Installation

1. **Copy files to VPS:**
```bash
scp -r dist package.json .env your-user@your-vps:/opt/mcp-server/
```

2. **SSH into VPS:**
```bash
ssh your-user@your-vps
cd /opt/mcp-server
npm install --production
```

3. **Update .env on VPS:**
```bash
nano .env
# Set HOST=0.0.0.0 to listen on all interfaces
# Set PORT=3000 (or your preferred port)
```

4. **Open firewall port:**
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

### Option 2: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist ./dist
COPY .env ./

EXPOSE 3000

CMD ["npm", "run", "start:http"]
```

Build and run:
```bash
docker build -t mcp-server .
docker run -d -p 3000:3000 --name mcp-server mcp-server
```

### Option 3: Nginx Reverse Proxy (Recommended for Production)

1. **Install Nginx:**
```bash
sudo apt install nginx
```

2. **Create Nginx config** `/etc/nginx/sites-available/mcp-server`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE specific settings
        proxy_buffering off;
        proxy_cache off;
    }
}
```

3. **Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/mcp-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. **Add SSL with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

5. **In n8n, use:**
```
Endpoint: https://your-domain.com/sse
```

## Security Considerations

### For Production:

1. **Add Authentication** - Modify `src/http-server.ts` to add API key authentication:

```typescript
// Add to setupMiddleware()
this.app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

2. **Update .env:**
```env
API_KEY=your-secure-api-key-here
```

3. **In n8n MCP Client**, add to Options:
```
headers: { "x-api-key": "your-secure-api-key-here" }
```

4. **Use HTTPS** - Always use SSL/TLS in production

5. **Firewall Rules** - Only allow trusted IP addresses if possible

6. **Rate Limiting** - Add rate limiting to prevent abuse:
```bash
npm install express-rate-limit
```

## Troubleshooting

### Connection Issues

**Problem**: n8n can't connect to MCP server

**Solutions**:
- Check server is running: `curl http://localhost:3000/health`
- Verify endpoint URL in n8n matches server
- Check firewall allows the port
- Look at server logs for errors

### CORS Errors

**Problem**: CORS errors in browser console

**Solution**: The server already has CORS enabled. If you need to restrict origins, modify `src/http-server.ts`:

```typescript
this.app.use(cors({
  origin: "https://your-n8n-domain.com",
  // ...
}));
```

### Tools Not Showing

**Problem**: Tools don't appear in n8n

**Solutions**:
- Check `/health` endpoint returns OK
- Verify Gmail/PostgreSQL credentials in `.env`
- Check server logs for initialization errors
- Test tools endpoint: `curl http://localhost:3000/`

### Gmail/PostgreSQL Errors

**Problem**: "Service not initialized" errors

**Solutions**:
- Verify credentials in `.env` are correct
- For Gmail: regenerate refresh token if expired
- For PostgreSQL: test database connection separately
- Check server startup logs for specific errors

## Example n8n Workflow

Here's a complete example workflow:

```json
{
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking 'Test workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.query }}",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "name": "AI Agent",
      "position": [450, 300]
    },
    {
      "parameters": {
        "endpoint": "http://localhost:3000/sse",
        "transport": "sse"
      },
      "type": "@n8n/n8n-nodes-langchain.toolMcpClient",
      "name": "MCP Client",
      "position": [450, 450]
    }
  ],
  "connections": {
    "When clicking 'Test workflow'": {
      "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]]
    },
    "MCP Client": {
      "ai_tool": [[{ "node": "AI Agent", "type": "ai_tool", "index": 0 }]]
    }
  }
}
```

## Monitoring

### Check Server Status
```bash
curl http://localhost:3000/health
```

### View Available Tools
```bash
curl http://localhost:3000/
```

### Server Logs
```bash
# If using PM2
pm2 logs mcp-server

# If running directly
# Check terminal output
```

## Support

For issues or questions:
1. Check server logs
2. Verify credentials
3. Test endpoints manually with curl
4. Check n8n MCP Client documentation

