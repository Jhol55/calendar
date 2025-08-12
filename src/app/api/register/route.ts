import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/services/session';
import { authService } from '@/services/auth';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const encryptedData = {
    email: requestData.email,
    password: await authService.hashPassword(requestData.password),
  };

  try {
    await prisma.user.create({
      data: encryptedData,
    });
  } catch (error) {
    console.error('Erro na requisição:', error);
  }

  await sessionService.deleteSession();
  await sessionService.createSession(requestData);

  console.log(
    await authService.generateValidationCodeFromEmail(requestData.email),
  );

  return NextResponse.json({
    success: true,
    status: 201,
  });
}
