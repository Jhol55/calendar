import { z } from 'zod';

export const registerFormSchema = z
  .object({
    email: z
      .string()
      .max(64, 'O email deve ter no máximo 64 caracteres')
      .email('Email inválido'),
    password: z
      .string()
      .min(6, 'A senha deve ter no mínimo 6 caracteres')
      .max(64, 'A senha deve ter no máximo 64 caracteres'),
    repeatPassword: z
      .string()
      .min(6, 'A senha deve ter no mínimo 6 caracteres')
      .max(64, 'A senha deve ter no máximo 64 caracteres'),
  })
  .refine((formData) => formData.password === formData.repeatPassword, {
    message: 'As senhas não coincidem',
    path: ['repeatPassword'],
  });
