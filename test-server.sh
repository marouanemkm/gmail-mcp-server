#!/bin/bash

echo "🧪 Testing MCP Server..."
echo ""

# Test health endpoint
echo "1️⃣  Testing /health endpoint..."
HEALTH=$(curl -s http://localhost:3000/health)
if [ $? -eq 0 ]; then
    echo "✅ Health check passed"
    echo "   Response: $HEALTH"
else
    echo "❌ Health check failed - is the server running?"
    echo "   Start it with: npm run dev:http"
    exit 1
fi

echo ""

# Test main endpoint
echo "2️⃣  Testing main endpoint (/)..."
INFO=$(curl -s http://localhost:3000/)
if [ $? -eq 0 ]; then
    echo "✅ Server info retrieved"
    echo "$INFO" | python3 -m json.tool 2>/dev/null || echo "$INFO"
else
    echo "❌ Failed to get server info"
    exit 1
fi

echo ""
echo "✅ All tests passed!"
echo ""
echo "📍 Server is running at: http://localhost:3000"
echo "📍 For n8n, use endpoint: http://localhost:3000/sse"
echo ""
echo "🔗 Available endpoints:"
echo "   • Health:  http://localhost:3000/health"
echo "   • Info:    http://localhost:3000/"
echo "   • SSE:     http://localhost:3000/sse (for n8n)"

