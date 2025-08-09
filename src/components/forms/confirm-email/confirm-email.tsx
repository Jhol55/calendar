import { confirmEmailFormSchema } from '@/components/forms/confirm-email/confirm-email.schema';
import { Form } from '@/components/ui/form';
import { InputOTP } from '@/components/ui/input-otp';
import { SubmitButton } from '@/components/ui/submit-button';
import { ErrorField } from '@/components/ui/error-field';
import { confirmEmailFormMask } from '@/components/forms/confirm-email/confirm-email.mask';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { userService } from '@/services/user';
import { useUser } from '@/hooks/use-user';
import { FormControl } from '@/components/ui/form-control';

export const ConfirmEmailForm = () => {
  const router = useRouter();
  const { user } = useUser();

  const handleSumit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    const response = await userService.confirmEmail({
      ...data,
      email: user?.email,
    });

    if (!response?.success) {
      setError('validationCode', {
        message: 'Código inválido',
      });
      return;
    }

    router.push('/index');
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
