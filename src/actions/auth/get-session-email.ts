'use server';

import { getSession } from '@/utils/security/session';

export async function getSessionEmail(): Promise<{
  success: boolean;
  email?: string;
  message?: string;
}> {
  try {
    const session = await getSession();
    const sessionEmail = (session as { user?: { email?: string } } | null)?.user
      ?.email;

    if (!sessionEmail) {
      return {
        success: false,
        message: 'No session found',
      };
    }

    return {
      success: true,
      email: sessionEmail,
    };
  } catch (error: any) {
    console.error('Error getting session email:', error);
    return {
      success: false,
      message: 'Failed to get session email',
    };
  }
}
