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
import { getUserSubscription } from '@/actions/plans/get-user-subscription';
import { createCheckoutSession } from '@/actions/plans/create-checkout';
import { getSessionHasPlan } from '@/actions/auth/get-session-has-plan';

export const LoginForm = ({
  className,
  children,
  onSuccess,
}: {
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
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

    // Se há um callback personalizado, usar ele
    if (onSuccess) {
      onSuccess();
      return;
    }

    // Verificar se há plano pendente no sessionStorage
    const pendingPlanId =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('pendingPlanId')
        : null;
    const pendingPaymentFreq =
      typeof window !== 'undefined'
        ? (sessionStorage.getItem('pendingPaymentFreq') as
            | 'monthly'
            | 'yearly'
            | null)
        : null;

    if (pendingPlanId && pendingPaymentFreq) {
      // Limpar sessionStorage primeiro
      sessionStorage.removeItem('pendingPlanId');
      sessionStorage.removeItem('pendingPaymentFreq');

      try {
        // Verificar se o usuário tem plano ativo
        const subscriptionResult = await getUserSubscription();

        // Se não tem subscription ou não está ativa, criar checkout diretamente
        const hasActivePlan =
          subscriptionResult.success &&
          subscriptionResult.data &&
          (subscriptionResult.data.status === 'active' ||
            subscriptionResult.data.status === 'trialing');

        if (!hasActivePlan) {
          // Criar checkout session e redirecionar para Stripe
          const planId = parseInt(pendingPlanId, 10);
          const checkoutResult = await createCheckoutSession(
            planId,
            pendingPaymentFreq,
          );

          if (checkoutResult.success && checkoutResult.url) {
            // Se for Trial, redirecionar para /billing (que depois vai para /index se necessário)
            // Se for plano pago, redirecionar para Stripe
            if (
              checkoutResult.url.includes('/billing') ||
              checkoutResult.url.includes('/index')
            ) {
              router.push(checkoutResult.url.replace(/^https?:\/\/[^/]+/, ''));
              return;
            }
            // Se for Stripe, usar window.location.href
            window.location.href = checkoutResult.url;
            return;
          } else {
            // Se falhar, redirecionar para /plans
            console.error('Erro ao criar checkout:', checkoutResult.message);
            router.push('/plans');
            return;
          }
        }

        // Se tem plano ativo, redirecionar para /plans (sem criar checkout)
        router.push('/plans');
      } catch (error) {
        console.error(
          'Erro ao verificar subscription ou criar checkout:',
          error,
        );
        router.push('/plans');
      }
    } else {
      // Não há plano pendente - verificar se tem plano ativo na sessão e redirecionar
      const sessionResult = await getSessionHasPlan();

      if (sessionResult.success && sessionResult.hasPlan) {
        router.push('/index');
      } else {
        router.push('/plans');
      }
    }
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
