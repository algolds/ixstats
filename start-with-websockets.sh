#!/bin/bash

# Start IxStats with Real-Time Intelligence WebSocket Server

echo "🚀 Starting IxStats with Real-Time Intelligence..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🧹 Cleaning up processes..."
    kill -TERM $WEBSOCKET_PID $NEXTJS_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start WebSocket server in background
echo "📡 Starting WebSocket Intelligence Server on port 3555..."
npm run websocket:server &
WEBSOCKET_PID=$!

# Wait a moment for WebSocket server to start
sleep 2

# Start Next.js development server
echo "🌐 Starting Next.js Development Server..."
npm run dev &
NEXTJS_PID=$!

echo "✅ Both servers started!"
echo "   • Next.js App: http://localhost:3000"
echo "   • WebSocket Server: ws://localhost:3555/ws/intelligence"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $WEBSOCKET_PID $NEXTJS_PID