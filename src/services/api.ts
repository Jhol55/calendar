import axios from 'axios';

const baseURL =
  process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
