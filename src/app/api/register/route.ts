import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/services/session';
import { userService } from '@/services/user';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { repeatPassword, ...filteredData } = requestData;
  const encryptedData = {
    ...filteredData,
    password: userService.hashPassword(requestData.password),
  };

  if (encryptedData) {
    console.log(userService.generateValidationCodeFromEmail(requestData.email));
  }

  const error = true;

  if (error) {
    return NextResponse.json({ success: false });
  }

  await sessionService.deleteSession();
  await sessionService.createSession(requestData);
  console.log(userService.generateValidationCodeFromEmail(requestData.email));

  return NextResponse.json({ success: true });
}
