import { FormContextProps } from './form-context.type';
import { createContext } from 'react';

export const FormContext = createContext<FormContextProps | null>(null);

export const FormProvider = ({
  children,
  value,
}: {
  value: FormContextProps;
  children?: React.ReactNode;
}) => {
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};
