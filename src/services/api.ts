import xior from 'xior';

const internalBaseURL = 'http://app:3000/api';
const externalBaseURL = process.env.NEXT_PUBLIC_API_URL;

const baseURL =
  process.env.NODE_ENV === 'production'
    ? typeof window === 'undefined'
      ? internalBaseURL
      : externalBaseURL
    : 'http://localhost:3000/api';

export const api = xior.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
