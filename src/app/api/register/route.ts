import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/services/session';
import { userService } from '@/services/user';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const { repeatPassword, ...filteredData } = requestData;

  if (repeatPassword !== requestData.password) {
    return NextResponse.json({ success: false, status: 400 });
  }

  const encryptedData = {
    ...filteredData,
    password: userService.hashPassword(requestData.password),
  };

  const newUser = await prisma.user.create({
    data: encryptedData,
  });

  await sessionService.deleteSession();
  await sessionService.createSession(requestData);
  console.log(userService.generateValidationCodeFromEmail(requestData.email));

  return NextResponse.json({ success: true, status: 201, data: newUser });
}
