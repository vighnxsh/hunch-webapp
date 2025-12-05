import { NextRequest, NextResponse } from 'next/server';

// CORS headers for actions.json
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
    'Content-Type': 'application/json',
  };
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

// GET endpoint - Returns actions.json mapping
export async function GET(request: NextRequest) {
  const actionsJson = {
    rules: [
      {
        pathPattern: '/market/*',
        apiPath: '/api/actions/market/*',
      },
      {
        pathPattern: '/api/actions/**',
        apiPath: '/api/actions/**',
      },
    ],
  };

  return NextResponse.json(actionsJson, { headers: getCorsHeaders() });
}

