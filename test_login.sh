#!/bin/bash
echo "Testing login endpoint (should work without token)..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -v 2>&1 | grep -E "(HTTP|success|token|Unauthorized|401)"
