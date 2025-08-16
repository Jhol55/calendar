import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/utils/security/auth';
import { createSession } from '@/utils/security/session';
import { RESPONSES } from '@/constants/responses';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const user = await prisma.user.findUnique({
    where: { email: requestData.email },
    select: { password: true },
  });

  if (!user) {
    return NextResponse.json(
      {
        success: RESPONSES.LOGIN.USER_NOT_FOUND.success,
        message: RESPONSES.LOGIN.USER_NOT_FOUND.message,
        code: RESPONSES.LOGIN.USER_NOT_FOUND.code,
      },
      { status: 200 },
    );
  }

  const success = await verifyPassword(requestData.password, user.password);

  if (success) {
    await createSession(requestData);

    return NextResponse.json(
      {
        success: RESPONSES.LOGIN.SUCCESS.success,
        message: RESPONSES.LOGIN.SUCCESS.message,
        code: RESPONSES.LOGIN.SUCCESS.code,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      success: RESPONSES.LOGIN.INVALID_PASSWORD.success,
      message: RESPONSES.LOGIN.INVALID_PASSWORD.message,
      code: RESPONSES.LOGIN.INVALID_PASSWORD.code,
    },
    { status: 200 },
  );
}
