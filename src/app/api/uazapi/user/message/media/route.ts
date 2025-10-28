import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, token, formData } = requestData;

    if (!email || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${process.env.UAZAPI_URL}/send/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: `${token}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending media:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
