export const CODES = {
  LOGIN: {
    SUCCESS: 0,
    USER_NOT_FOUND: 1,
    INVALID_PASSWORD: 2,
  },
  REGISTER: {
    SUCCESS: 0,
    USER_ALREADY_EXISTS: 1,
  },
};

export const RESPONSES = {
  LOGIN: {
    SUCCESS: {
      code: CODES.LOGIN.SUCCESS,
      success: true,
      status: 200,
      message: 'Login realizado com sucesso',
    },
    USER_NOT_FOUND: {
      code: CODES.LOGIN.USER_NOT_FOUND,
      success: false,
      status: 404,
      message: 'Email ou senha inválidos',
    },
    INVALID_PASSWORD: {
      code: CODES.LOGIN.INVALID_PASSWORD,
      success: false,
      status: 401,
      message: 'Email ou senha inválidos',
    },
  },
  REGISTER: {
    SUCCESS: {
      code: CODES.REGISTER.SUCCESS,
      success: true,
      status: 201,
      message: 'Registro realizado com sucesso',
    },
    USER_ALREADY_EXISTS: {
      code: CODES.REGISTER.USER_ALREADY_EXISTS,
      success: false,
      status: 409,
      message: 'Este e-mail já está em uso',
    },
  },
};
