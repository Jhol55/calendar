import { confirmEmailFormSchema } from '@/features/forms/confirm-email/confirm-email.schema';
import { Form } from '@/components/ui/form';
import { InputOTP } from '@/components/ui/input-otp';
import { SubmitButton } from '@/components/ui/submit-button';
import { ErrorField } from '@/components/ui/error-field';
import { confirmEmailFormMask } from '@/features/forms/confirm-email/confirm-email.mask';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { FormControl } from '@/components/ui/form-control';
import { confirmEmail } from '@/actions/user/confirm-email';

export const ConfirmEmailForm = () => {
  const router = useRouter();
  const { user } = useUser();

  const handleSumit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    const formData = new FormData();

    formData.append('email', user?.email || '');
    formData.append('validationCode', data.validationCode);

    const response = await confirmEmail(formData);

    if (!response.success) {
      setError(response.field as string, {
        message: response.message,
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
