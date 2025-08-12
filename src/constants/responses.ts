export const CODES = {
  LOGIN: {
    SUCCESS: 0,
    USER_NOT_FOUND: 1,
    INVALID_PASSWORD: 2,
  },
  REGISTER: {
    SUCCESS: 0,
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
      message: 'Usuário não encontrado',
    },
    INVALID_PASSWORD: {
      code: CODES.LOGIN.INVALID_PASSWORD,
      success: false,
      status: 401,
      message: 'Senha incorreta',
    },
  },
  REGISTER: {
    SUCCESS: {
      code: CODES.REGISTER.SUCCESS,
      success: true,
      status: 201,
      message: 'Registro realizado com sucesso',
    },
  },
};
