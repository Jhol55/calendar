import { confirmEmailFormSchema } from '@/components/features/forms/confirm-email/confirm-email.schema';
import { Form } from '@/components/ui/form';
import { InputOTP } from '@/components/ui/input-otp';
import { SubmitButton } from '@/components/ui/submit-button';
import { ErrorField } from '@/components/ui/error-field';
import { confirmEmailFormMask } from '@/components/features/forms/confirm-email/confirm-email.mask';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { FormControl } from '@/components/ui/form-control';
import { confirmEmail } from '@/actions/forms/confirm-email';
import { getUserSubscription } from '@/actions/plans/get-user-subscription';
import { createCheckoutSession } from '@/actions/plans/create-checkout';
import { useEffect, useState } from 'react';

export const ConfirmEmailForm = () => {
  const router = useRouter();
  const { user } = useUser();
  const [emailToUse, setEmailToUse] = useState<string | null>(null);

  // Buscar email de forma prioritária: useUser > sessionStorage > sessão servidor
  useEffect(() => {
    const loadEmail = async () => {
      // Priorizar email do hook useUser (quando usuário está logado)
      if (user?.email) {
        setEmailToUse(user.email);
        return;
      }

      // Se não tiver, tentar sessionStorage (fluxo de registro inicial)
      const pendingEmail =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('pendingEmail')
          : null;
      if (pendingEmail) {
        setEmailToUse(pendingEmail);
        return;
      }

      // Por último, buscar diretamente da sessão no servidor
      // Isso garante que mesmo quando o hook ainda não carregou, temos o email
      const { getSessionEmail } = await import(
        '@/actions/auth/get-session-email'
      );
      const sessionResult = await getSessionEmail();
      if (sessionResult.success && sessionResult.email) {
        setEmailToUse(sessionResult.email);
      }
    };

    loadEmail();
  }, [user?.email]);

  const handleSumit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    if (!emailToUse) {
      setError('validationCode', {
        message: 'Email não encontrado. Por favor, registre-se novamente.',
      });
      return;
    }

    const formData = new FormData();

    formData.append('email', emailToUse);
    formData.append('validationCode', data.validationCode);

    const response = await confirmEmail(formData);

    if (!response.success) {
      setError(response.field as string, {
        message: response.message,
      });
      return;
    }

    // Limpar email pendente do sessionStorage após redirecionamento iniciado
    // Usar setTimeout para garantir que o redirecionamento seja iniciado primeiro
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pendingEmail');
      }
    }, 100);

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
      // Limpar sessionStorage
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

        // Se tem plano ativo, redirecionar para /plans
        router.push('/plans');
      } catch (error) {
        console.error(
          'Erro ao verificar subscription ou criar checkout:',
          error,
        );
        router.push('/plans');
      }
    } else {
      router.push('/plans');
    }
  };

  return (
    <Form
      className="flex flex-col gap-2 w-full px-4"
      zodSchema={confirmEmailFormSchema}
      maskSchema={confirmEmailFormMask}
      onSubmit={handleSumit}
    >
      <div className="flex justify-center">
        <div className="flex flex-col gap-2">
          <FormControl variant="label" htmlFor="validationCode">
            Código de confirmação
          </FormControl>
          <InputOTP id="validationCode" length={6} fieldName="validationCode" />
          <ErrorField fieldName="validationCode" />
        </div>
      </div>
      <SubmitButton variant="gradient">Confirmar</SubmitButton>
    </Form>
  );
};
