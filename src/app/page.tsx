'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FlipCard } from '@/components/ui/flip-card';
import { Typography } from '@/components/ui/typography';
import { LoginForm } from '@/components/features/forms/login';
import { RegisterForm } from '@/components/features/forms/register';
import { Navbar } from '@/components/layout/navbar';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { getPlans } from '@/actions/plans/get-plans';
import { Plan } from '@/types/subscription';
import { PLAN_FEATURES } from '@/config/plans.config';
import { PricingCard } from '@/components/layout/pricing/pricing-card';
import { Loading } from '@/components/ui/loading';
import { Tab } from '@/components/layout/pricing/tab';
import { Bot, Workflow, Code2, Database, Webhook } from 'lucide-react';
import { AuroraBackground } from '@/components/ui/aurora-background';

export default function Home() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPaymentFreq, setSelectedPaymentFreq] = useState<
    'monthly' | 'yearly'
  >('monthly');

  useOutsideClick(modalRef, () => {
    if (showLoginModal) {
      setShowLoginModal(false);
    }
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const result = await getPlans();
      if (result.success && result.data) {
        setPlans(result.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const getFeatures = (slug: string): readonly string[] => {
    const normalizedSlug = slug.toLowerCase() as
      | 'starter'
      | 'business'
      | 'enterprise'
      | 'trial';
    const features = PLAN_FEATURES[normalizedSlug] || [];
    return features;
  };

  const getAllFeatures = (plan: Plan): string[] => {
    const features = getFeatures(plan.slug);

    // Calcular texto de armazenamento
    const storageText =
      plan.maxStorageMB >= 1000
        ? `${(plan.maxStorageMB / 1000).toFixed(plan.maxStorageMB % 1000 === 0 ? 0 : 2)}GB de armazenamento`
        : `${plan.maxStorageMB}MB de armazenamento`;

    // Calcular texto de instâncias
    const instancesText =
      plan.maxInstances === -1
        ? 'Instâncias ilimitadas'
        : `${plan.maxInstances} instância${plan.maxInstances > 1 ? 's' : ''} WhatsApp`;

    // Adicionar armazenamento e instâncias no início da lista
    return [storageText, instancesText, ...(features as string[])];
  };

  const handleSelectPlan = (planId: number) => {
    // Salvar planId no sessionStorage e abrir modal de login
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pendingPlanId', planId.toString());
      sessionStorage.setItem('pendingPaymentFreq', selectedPaymentFreq);
    }
    setShowLoginModal(true);
  };

  const features = [
    {
      icon: <Workflow size={32} />,
      title: 'Workflow Builder Visual',
      description:
        'Construa automações complexas com drag-and-drop. Interface visual intuitiva para criar workflows multi-etapas sem precisar escrever código.',
    },
    {
      icon: <Bot size={32} />,
      title: 'Agentes de IA',
      description:
        'Integre agentes inteligentes com OpenAI GPT-4. Suporte a tools/functions calling, histórico de conversas e contexto personalizado para automatizar decisões complexas.',
    },
    {
      icon: <Code2 size={32} />,
      title: 'Código quando precisar',
      description:
        'Execute JavaScript ou Python diretamente nos workflows. Combine automação visual com código customizado para máxima flexibilidade.',
    },
    {
      icon: <Database size={32} />,
      title: 'Banco de Dados Integrado',
      description:
        'Armazene e gerencie dados diretamente nos workflows. Crie tabelas, faça consultas e transforme dados em tempo real.',
    },
    {
      icon: <Webhook size={32} />,
      title: 'Integrações via Webhook',
      description:
        'Conecte-se com qualquer sistema via webhooks e HTTP requests. Integre WhatsApp, APIs externas e serviços personalizados.',
    },
  ];

  return (
    <div className="relative z-10 bg-white/95">
      {/* Navbar */}
      <Navbar
        style={{ zoom: 0.9 }}
        onLoginClick={() => setShowLoginModal(true)}
      />

      {/* Login/Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden w-screen">
          {/* <div className="fixed inset-0 -z-50">
            <Image
              src="/background.jpg"
              fill
              alt=""
              className="object-cover opacity-60"
            />
          </div> */}
          <div className="relative w-full h-[90vh] max-h-[90vh] flex justify-center items-center">
            <div className="relative flex justify-center items-center w-full h-full p-10">
              <div
                ref={modalRef}
                className="w-full h-full flex justify-center items-center xl:w-2/3"
                style={{ zoom: 0.9 }}
              >
                <section className="md:flex flex-col hidden relative justify-center items-center w-full h-full gap-8">
                  <LoginForm className="z-1" />
                </section>
                <section
                  className="relative flex justify-center items-center w-full h-full gap-8"
                  style={{ perspective: '1200px' }}
                >
                  <FlipCard
                    className="bg-neutral-50 px-4"
                    renderFront={(isFlipped, setIsFlipped) => (
                      <>
                        <LoginForm className="md:hidden flex items-center">
                          <div className="flex items-center mt-2">
                            <Typography
                              variant="span"
                              className="whitespace-nowrap"
                            >
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
                          <Typography
                            variant="span"
                            className="whitespace-nowrap"
                          >
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
                            <Typography
                              variant="span"
                              className="whitespace-nowrap"
                            >
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
                          <Typography
                            variant="span"
                            className="whitespace-nowrap"
                          >
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 w-screen">
        <AuroraBackground className="min-h-screen relative" />
        <div className="max-w-7xl mx-auto" style={{ zoom: 0.8 }}>
          <div className="text-center space-y-6">
            <Typography
              variant="h1"
              className="text-5xl font-bold text-neutral-900"
            >
              Automatize os processos da sua empresa
            </Typography>
            <Typography
              variant="p"
              className="text-xl text-neutral-600 max-w-2xl mx-auto"
            >
              Construa workflows complexos com drag-and-drop ou código. Integre
              IA, conecte sistemas e automatize processos multi-etapas.
            </Typography>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button
                variant="gradient"
                bgHexColor="#545556"
                className="px-8 py-3 text-lg"
                onClick={() => {
                  // Encontrar o plano Trial e salvar como pendente
                  const trialPlan = plans.find((p) => p.slug === 'trial');
                  if (trialPlan) {
                    handleSelectPlan(trialPlan.id);
                  } else {
                    setShowLoginModal(true);
                  }
                }}
              >
                Teste Grátis
              </Button>
              <Button
                variant="default"
                bgHexColor="#e5e5e5"
                className="px-8 py-3 text-lg text-neutral-900"
              >
                Agendar Demonstração
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="resources" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto" style={{ zoom: 0.8 }}>
          <div className="text-center mb-16">
            <Typography
              variant="h2"
              className="text-4xl font-bold text-neutral-900 mb-4"
            >
              Recursos que vão elevar o nível dos seus processos
            </Typography>
            <Typography
              variant="p"
              className="text-xl text-neutral-600 max-w-3xl mx-auto"
            >
              Construa automações poderosas combinando interface visual e
              código. Integre IA, conecte sistemas e automatize processos
              complexos.
            </Typography>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex flex-col items-start p-6 rounded-xl border border-neutral-200 bg-neutral-50 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4 text-neutral-600">{feature.icon}</div>
                <Typography
                  variant="h3"
                  className="text-xl font-semibold mb-2 text-neutral-900"
                >
                  {feature.title}
                </Typography>
                <Typography variant="p" className="text-neutral-600">
                  {feature.description}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section id="plans" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-6 mb-12" style={{ zoom: 0.8 }}>
            <Typography
              variant="h2"
              className="text-4xl font-bold text-neutral-900"
            >
              Conheça nossos planos
            </Typography>
            <Typography
              variant="p"
              className="text-xl text-neutral-600 max-w-2xl mx-auto"
            >
              Teste grátis por 7 dias. Não precisa incluir um cartão de crédito.
            </Typography>

            {/* Payment Frequency Toggle */}
            <div className="mx-auto flex w-fit rounded-lg bg-white border border-neutral-200 p-1.5 shadow-sm mt-6">
              <Tab
                text="Mensal"
                selected={selectedPaymentFreq === 'monthly'}
                setSelected={() => setSelectedPaymentFreq('monthly')}
                discount={false}
              />
              <Tab
                text="Anual"
                selected={selectedPaymentFreq === 'yearly'}
                setSelected={() => setSelectedPaymentFreq('yearly')}
                discount={true}
              />
            </div>
          </div>

          {/* Pricing Cards */}
          {loadingPlans ? (
            <div className="flex items-center justify-center py-20">
              <Loading size="md" variant="spinner" />
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
              style={{ zoom: 0.9 }}
            >
              {plans.map((plan) => {
                const isPopular = plan.slug === 'business';
                const isTrial = plan.slug === 'trial';
                const allFeatures = getAllFeatures(plan);

                return (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    paymentFrequency={selectedPaymentFreq}
                    features={allFeatures}
                    isPopular={isPopular}
                    isTrial={isTrial}
                    disabled={false}
                    onSelect={() => handleSelectPlan(plan.id)}
                    isLoading={false}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Typography variant="h2" className="text-xl font-bold mb-4">
                4itt
              </Typography>
              <Typography variant="p" className="text-neutral-400 text-sm">
                Jhonathan Aparecido Galhardo dos Santos
              </Typography>
            </div>
            <div>
              <Typography variant="h5" className="font-semibold mb-4">
                Produto
              </Typography>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <a
                    href="#resources"
                    className="hover:text-white transition-colors"
                  >
                    Recursos
                  </a>
                </li>
                <li>
                  <a
                    href="#plans"
                    className="hover:text-white transition-colors"
                  >
                    Planos
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <Typography variant="h5" className="font-semibold mb-4">
                Empresa
              </Typography>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <a
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Termos de Uso
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <Typography variant="h5" className="font-semibold mb-4">
                Suporte
              </Typography>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentação
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contato
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-sm text-neutral-400">
            <Typography variant="span">
              © {new Date().getFullYear()} 4itt. Todos os direitos reservados.
            </Typography>
          </div>
        </div>
      </footer>
    </div>
  );
}
