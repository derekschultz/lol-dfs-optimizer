#!/bin/bash

# Service verification script for LOL DFS Optimizer

echo "Checking LOL DFS Optimizer Services..."
echo "======================================"

# Check main server
echo -n "Main Server (3000): "
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

# Check client
echo -n "Client App (3001): "
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

# Check AI service
echo -n "AI Service (3002): "
if curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

echo "======================================"

# Check if all services are running
if curl -s http://localhost:3000/api/health > /dev/null 2>&1 && \
   curl -s http://localhost:3001 > /dev/null 2>&1 && \
   curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "All services are running!"
    echo "Access the app at: http://localhost:3001"
else
    echo "Some services are not running."
    echo "Start all services with: npm start"
fi