'use client';

import { Button } from '@/components/ui/button';
import { FlipCard } from '@/components/ui/flip-card';
import { Typography } from '@/components/ui/typography';
import { LoginForm } from '@/components/forms/login';
import { RegisterForm } from '@/components/forms/register';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="relative flex justify-center items-center w-screen h-screen overflow-hidden p-10">
      <section className="md:flex flex-col hidden md:w-1/2 xl:w-1/3 relative justify-center items-center w-full h-full gap-8">
        <LoginForm className="z-1" />
      </section>
      <section
        className="md:w-1/2 xl:w-1/3 relative flex justify-center items-center w-full h-full gap-8"
        style={{ perspective: '1200px' }}
      >
        <FlipCard
          className="md:bg-zinc-900/95 bg-zinc-900 px-4"
          renderFront={(isFlipped, setIsFlipped) => (
            <>
              <LoginForm className="md:hidden flex items-center">
                <div className="flex items-center mt-2">
                  <Typography variant="span" className="whitespace-nowrap">
                    Não tem uma conta?
                  </Typography>
                  <Button
                    className="underline text-md px-2"
                    bgHexColor="#00000000"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    Registre-se
                  </Button>
                </div>
              </LoginForm>
              <div className="md:flex md:flex-col hidden gap-2">
                <Typography variant="span" className="whitespace-nowrap">
                  Não tem uma conta?
                </Typography>
                <Button
                  variant="gradient"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  Registre-se
                </Button>
              </div>
            </>
          )}
          renderBack={(isFlipped, setIsFlipped) => (
            <>
              <RegisterForm className="md:hidden flex items-center">
                <div className="flex items-center mt-2">
                  <Typography variant="span" className="whitespace-nowrap">
                    Já possui uma conta?
                  </Typography>
                  <Button
                    className="underline text-md px-2"
                    bgHexColor="#00000000"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    Login
                  </Button>
                </div>
              </RegisterForm>
              <div className="md:flex flex-col hidden gap-2">
                <Typography variant="span" className="whitespace-nowrap">
                  Já possui uma conta?
                </Typography>
                <Button
                  variant="gradient"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  Login
                </Button>
              </div>
            </>
          )}
        />
        <RegisterForm className="md:flex hidden" />
      </section>
      <Image
        src="/background.jpg"
        fill
        alt=""
        className="fixed object-cover -z-50 opacity-60"
      />
    </main>
  );
}
