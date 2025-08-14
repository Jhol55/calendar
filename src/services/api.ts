import xior from 'xior';

const baseURL =
  process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api';

export const api = xior.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
