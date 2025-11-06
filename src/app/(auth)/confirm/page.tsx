'use client';

import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { ConfirmEmailForm } from '@/components/features/forms/confirm-email';
import { useUser } from '@/hooks/use-user';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Confirm() {
  const { user, handleUpdate } = useUser();

  // Estado local para manter o email exibido mesmo após limpar sessionStorage
  const [displayEmail, setDisplayEmail] = useState<string>('seu email');

  // Invalidar cache quando a página carregar para garantir dados atualizados
  useEffect(() => {
    handleUpdate();
  }, [handleUpdate]);

  // Atualizar displayEmail quando user ou sessionStorage mudarem
  useEffect(() => {
    const loadEmail = async () => {
      // Priorizar email do hook useUser (quando usuário está logado)
      if (user?.email) {
        setDisplayEmail(user.email);
        return;
      }

      // Se não tiver, tentar sessionStorage (fluxo de registro inicial)
      const pendingEmail =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('pendingEmail')
          : null;
      if (pendingEmail) {
        setDisplayEmail(pendingEmail);
        return;
      }

      // Por último, buscar diretamente da sessão no servidor
      // Isso garante que mesmo quando o hook ainda não carregou, temos o email
      const { getSessionEmail } = await import(
        '@/actions/auth/get-session-email'
      );
      const sessionResult = await getSessionEmail();
      if (sessionResult.success && sessionResult.email) {
        setDisplayEmail(sessionResult.email);
      }
    };

    loadEmail();
  }, [user?.email]);

  return (
    <main className="relative flex justify-center items-center w-screen h-screen overflow-hidden p-6 md:p-10 bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800">
      <section
        className="relative w-full max-w-lg rounded-3xl bg-white/80 backdrop-blur border border-slate-200 shadow-xl px-6 py-8 md:px-10 md:py-12 flex flex-col items-center gap-6"
        style={{ zoom: 0.9 }}
      >
        <div className="w-full flex flex-col items-center gap-2">
          <Typography
            variant="h1"
            className="text-neutral-900 text-center mb-2"
          >
            Confirmar email
          </Typography>
          <Typography
            variant="p"
            className="text-center px-1.5 md:px-2.5 text-neutral-600"
          >
            Um código de confirmação foi enviado para
            <Typography variant="b" className="text-slate-900">
              {' ' + displayEmail}
            </Typography>
            . Por favor, verifique sua caixa de entrada e siga as instruções
            para completar o processo de registro.
          </Typography>
        </div>

        <div className="w-full">
          <ConfirmEmailForm />
        </div>

        <div className="flex items-center gap-2">
          <Typography
            variant="p"
            className="whitespace-nowrap text-neutral-600"
          >
            Não recebeu o código?
          </Typography>
          <Button
            className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
            bgHexColor="#00000000"
          >
            Clique aqui para reenvia-lo
          </Button>
        </div>
      </section>
      <Image
        src="/background.jpg"
        fill
        alt=""
        className="object-cover -z-50 opacity-20"
      />
    </main>
  );
}
