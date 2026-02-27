#!/bin/bash
# Stop TERMINUS

echo "Stopping TERMINUS processes..."
pkill -f "node.*packages/server"
pkill -f "vite"
echo "TERMINUS stopped."
