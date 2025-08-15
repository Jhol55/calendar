import { regex } from '@/constants/regex';

export const confirmEmailFormMask = {
  validationCode: (e: React.ChangeEvent<HTMLInputElement>) => {
    return e.target.value.replace(regex.ONLY_NUMBERS, '');
  },
};
