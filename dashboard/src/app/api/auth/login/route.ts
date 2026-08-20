import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const backendUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';
    
    // Call FastAPI backend auth endpoint
    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Authentication failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/auth/login] Error proxying login:', error);
    return NextResponse.json(
      { detail: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
