import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, createSession } from '@/utils/security/session';
import {
  hashPassword,
  generateValidationCodeFromEmail,
} from '@/utils/security/auth';
import { prisma } from '@/lib/prisma';
import { RESPONSES } from '@/constants/responses';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: requestData.email,
    },
  });

  if (existingUser) {
    return NextResponse.json(
      {
        success: RESPONSES.REGISTER.USER_ALREADY_EXISTS.success,
        message: RESPONSES.REGISTER.USER_ALREADY_EXISTS.message,
        code: RESPONSES.REGISTER.USER_ALREADY_EXISTS.code,
      },
      {
        status: 200,
      },
    );
  }

  const encryptedData = {
    email: requestData.email,
    password: await hashPassword(requestData.password),
  };

  try {
    await prisma.user.create({
      data: encryptedData,
    });
  } catch (error) {
    console.error('Erro na requisição:', error);
  }

  await deleteSession();
  await createSession(requestData);

  console.log(await generateValidationCodeFromEmail(requestData.email));

  return NextResponse.json(
    {
      success: RESPONSES.REGISTER.SUCCESS.success,
      message: RESPONSES.REGISTER.SUCCESS.message,
      code: RESPONSES.REGISTER.SUCCESS.code,
    },
    {
      status: 200,
    },
  );
}
