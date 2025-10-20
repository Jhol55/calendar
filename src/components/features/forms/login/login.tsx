import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { InputProps } from '@/components/ui/input/input.type';
import { ErrorField } from '@/components/ui/error-field';
import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { loginFormSchema } from '@/components/features/forms/login/login.schema';
import { useRouter } from 'next/navigation';
import { FormControl } from '@/components/ui/form-control';
import { login } from '@/actions/forms/login';

export const LoginForm = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  const baseId = useId();
  const router = useRouter();

  const inputs: (InputProps & { label: string })[] = [
    {
      label: 'Email',
      placeholder: 'sample@gmail.com',
      fieldName: 'email',
      type: 'email',
    },
    {
      label: 'Senha',
      placeholder: '••••••••••••',
      fieldName: 'password',
      type: 'password',
    },
  ];

  const handleSubmit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    const formData = new FormData();

    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('remember', data.remember || 'false');

    const response = await login(formData);

    if (!response.success) {
      setError(response.field as 'email' | 'password', {
        message: response.message,
      });
      return;
    }

    router.push('/index');
  };

  return (
    <Form
      className={cn(
        'flex flex-col gap-2 w-full h-full overflow-y-auto md:rounded-l-3xl rounded-l-3xl p-4 -z-50 bg-neutral-50',
        className,
      )}
      zodSchema={loginFormSchema}
      onSubmit={handleSubmit}
    >
      <div className="h-full" /> {/* justify-center when overflow */}
      {inputs.map((input, index) => (
        <React.Fragment key={index}>
          <FormControl variant="label" htmlFor={`${baseId}-${index}`}>
            {input.label}
          </FormControl>

          <Input
            id={`${baseId}-${index}`}
            type={input.type}
            fieldName={input.fieldName}
            placeholder={input.placeholder}
          />

          <ErrorField fieldName={input.fieldName} />
        </React.Fragment>
      ))}
      <div className="flex justify-between items-center w-full mb-2">
        <div className="flex items-center gap-2">
          <Input
            type="checkbox"
            id={`${baseId}-${inputs.length}`}
            fieldName="remember"
          />
          <FormControl
            variant="label"
            htmlFor={`${baseId}-${inputs.length}`}
            className="translate-y-[2px] whitespace-nowrap text-sm"
          >
            Lembrar de mim
          </FormControl>
        </div>
        <Link
          href="/forget-password"
          target="_blank"
          className="text-sm font-medium underline text-neutral-600"
        >
          Esqueceu a senha?
        </Link>
      </div>
      <SubmitButton variant="gradient">Login</SubmitButton>
      {children}
      <div className="h-full" /> {/* justify-center when overflow */}
    </Form>
  );
};
