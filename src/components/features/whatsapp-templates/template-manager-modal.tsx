'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl } from '@/components/ui/form-control';
import { FormSelect } from '@/components/ui/select';
import { Typography } from '@/components/ui/typography';
import { Textarea } from '@/components/ui/textarea';
import { Form } from '@/components/ui/form';
import { useForm } from '@/hooks/use-form';
import { X, Plus } from 'lucide-react';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { Loading } from '@/components/ui/loading';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceToken: string;
  onTemplateCreated?: () => void;
}

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: Array<{
    type: string;
    text?: string;
  }>;
  quality_score?: string; // GREEN, YELLOW, RED, UNKNOWN
  rejection_reason?: string; // Motivo da rejeição
  categoryUpdate?: {
    id: string;
    oldCategory: string | null;
    newCategory: string;
    updatedAt: string | Date;
    reviewed: boolean;
    appealed: boolean;
  };
}

// Schema de validação para o formulário de criação
const createTemplateSchema = z
  .object({
    templateName: z
      .string()
      .min(1, 'Nome é obrigatório')
      .transform((val) => val.toLowerCase().replace(/[^a-z0-9_]/g, '_')),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
    language: z.string().min(1, 'Idioma é obrigatório'),
    headerText: z.string().optional(),
    bodyText: z.string().min(1, 'Corpo da mensagem é obrigatório'),
    footerText: z.string().optional(),
    otpButtonText: z.string().optional(),
    otpType: z.enum(['ZERO_TAP', 'ONE_TAP']).optional(),
    otpSignatureHash: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'AUTHENTICATION') {
      if (!data.otpButtonText || data.otpButtonText.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['otpButtonText'],
          message:
            'Templates AUTHENTICATION devem ter um texto para o botão OTP',
        });
      }

      const otpType = data.otpType || 'ZERO_TAP';
      if (otpType === 'ZERO_TAP') {
        if (
          !data.otpSignatureHash ||
          data.otpSignatureHash.trim().length !== 11
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['otpSignatureHash'],
            message:
              'Para OTP ZERO_TAP é necessário informar o hash de assinatura com 11 caracteres.',
          });
        }
      }
    }
  });

// Componente interno com acesso ao form context
function TemplateFormFields() {
  const { setValue, form } = useForm();
  const otpTypeValue = (form.otpType as string) || 'ZERO_TAP';

  // Valores iniciais
  useEffect(() => {
    const timer = setTimeout(() => {
      setValue('category', 'UTILITY');
      setValue('language', 'pt_BR');
      setValue('otpType', 'ZERO_TAP');
    }, 0);
    return () => clearTimeout(timer);
  }, [setValue]);

  // Limpar headerText quando categoria mudar para AUTHENTICATION
  useEffect(() => {
    const category = form.category as string;
    if (category === 'AUTHENTICATION' && form.headerText) {
      setValue('headerText', '');
    }
  }, [form.category, form.headerText, setValue]);

  // Limpar hash quando mudar tipo de OTP
  useEffect(() => {
    if (otpTypeValue !== 'ZERO_TAP') {
      setValue('otpSignatureHash', '');
    }
  }, [otpTypeValue, setValue]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-1">
          <FormControl variant="label">Nome do Template *</FormControl>
          <Input
            type="text"
            fieldName="templateName"
            placeholder="pedido_confirmado"
          />
          <Typography variant="span" className="text-xs text-neutral-500">
            Apenas letras minúsculas, números e underscores
          </Typography>
        </div>

        <div className="p-1">
          <FormControl variant="label">Categoria *</FormControl>
          <FormSelect
            fieldName="category"
            placeholder="Selecione a categoria"
            options={[
              {
                value: 'UTILITY',
                label: '🔧 Utility - Notificações, confirmações',
              },
              {
                value: 'MARKETING',
                label: '📢 Marketing - Promoções, ofertas',
              },
              {
                value: 'AUTHENTICATION',
                label: '🔐 Authentication - Códigos de verificação',
              },
            ]}
            className="w-full"
          />
        </div>

        <div className="p-1">
          <FormControl variant="label">Idioma *</FormControl>
          <FormSelect
            fieldName="language"
            placeholder="Selecione o idioma"
            options={[
              { value: 'pt_BR', label: '🇧🇷 Português (Brasil)' },
              { value: 'en_US', label: '🇺🇸 English (US)' },
              { value: 'es', label: '🇪🇸 Español' },
            ]}
            className="w-full"
          />
        </div>
      </div>

      {form.category !== 'AUTHENTICATION' && (
        <div className="p-1">
          <FormControl variant="label">Cabeçalho (opcional)</FormControl>
          <Input
            type="text"
            fieldName="headerText"
            placeholder="Seu Pedido foi Confirmado!"
          />
        </div>
      )}

      <div className="p-1">
        <FormControl variant="label">
          Corpo da Mensagem *{' '}
          <span className="text-xs text-neutral-500">
            (Use {'{'}1{'}'} para variáveis)
          </span>
        </FormControl>
        <Textarea
          fieldName="bodyText"
          placeholder={
            'Olá {{1}}!\n\nSeu pedido #{{2}} foi confirmado.\nValor: R$ {{3}}\n\nObrigado pela preferência!'
          }
          rows={6}
          className="w-full"
        />
        <Typography variant="span" className="text-xs text-neutral-500">
          Variáveis: {'{'}1{'}'}, {'{'}2{'}'}, {'{'}3{'}'}... serão preenchidas
          ao enviar
        </Typography>
      </div>

      <div className="p-1">
        <FormControl variant="label">Rodapé (opcional)</FormControl>
        <Input
          type="text"
          fieldName="footerText"
          placeholder="Empresa XYZ - Atendimento 24h"
        />
      </div>

      {/* Botão OTP obrigatório para AUTHENTICATION */}
      {form.category === 'AUTHENTICATION' && (
        <div className="space-y-3">
          <div className="p-1">
            <FormControl variant="label">Texto do Botão OTP *</FormControl>
            <Input
              type="text"
              fieldName="otpButtonText"
              placeholder="Verificar código"
            />
            <Typography variant="span" className="text-xs text-neutral-500">
              Templates AUTHENTICATION devem ter exatamente um botão do tipo OTP
            </Typography>
          </div>

          <div className="p-1">
            <FormControl variant="label">Tipo de OTP *</FormControl>
            <FormSelect
              fieldName="otpType"
              placeholder="Selecione o tipo de OTP"
              options={[
                {
                  value: 'ZERO_TAP',
                  label: 'ZERO_TAP - Usuário digita o código',
                },
                {
                  value: 'ONE_TAP',
                  label: 'ONE_TAP - Código preenchido automaticamente',
                },
              ]}
              className="w-full"
            />
          </div>

          {otpTypeValue === 'ZERO_TAP' && (
            <div className="p-1">
              <FormControl variant="label">
                Hash de Assinatura (11 caracteres) *
              </FormControl>
              <Input
                type="text"
                fieldName="otpSignatureHash"
                placeholder="Ex: 1a2B3c4D5e6"
              />
              <Typography variant="span" className="text-xs text-neutral-500">
                Informe o hash de assinatura (11 caracteres) do aplicativo
                autorizado a receber o código. Exemplo: hash do app WhatsApp
                Business usado no fluxo de autenticação.
              </Typography>
            </div>
          )}
        </div>
      )}

      <SubmitButton variant="gradient" className="w-full">
        Criar Template
      </SubmitButton>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
        <p className="font-semibold text-blue-900 mb-1">ℹ️ Importante:</p>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li>Templates levam 24-48h para serem aprovados pela Meta</li>
          <li>Máximo de 100 templates por hora</li>
          <li>Você será notificado por webhook quando o status mudar</li>
        </ul>
      </div>
    </>
  );
}

export function TemplateManagerModal({
  isOpen,
  onClose,
  instanceToken,
  onTemplateCreated,
}: TemplateManagerModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (isOpen && instanceToken) {
      loadTemplates();
      // Resetar o formulário quando o modal abre
      setShowCreateForm(false);
    } else if (!isOpen) {
      // Resetar o formulário quando o modal fecha
      setShowCreateForm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, instanceToken]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/whatsapp-templates?instanceToken=${instanceToken}`,
      );
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (data: FieldValues) => {
    try {
      console.log('📤 Enviando dados do template:', {
        instanceToken,
        name: data.templateName,
        category: data.category,
        language: data.language,
        bodyText: data.bodyText,
      });

      const response = await fetch('/api/whatsapp-templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceToken,
          name: data.templateName,
          category: data.category,
          language: data.language,
          bodyText: data.bodyText,
          headerText: data.headerText || undefined,
          footerText: data.footerText || undefined,
          otpButtonText: data.otpButtonText || undefined,
          otpType: data.otpType || 'ZERO_TAP',
          otpSignatureHash: data.otpSignatureHash || undefined,
        }),
      });

      const responseData = await response.json();
      console.log('📥 Resposta do servidor:', responseData);

      if (responseData.success) {
        const message =
          responseData.message ||
          'Template criado com sucesso! Aguarde aprovação (24-48h).';
        alert(
          `✅ ${message}\n\n⚠️ Nota: O Meta pode reclassificar automaticamente a categoria do template durante a revisão se detectar que o conteúdo não se encaixa na categoria escolhida.`,
        );
        setShowCreateForm(false);
        loadTemplates();
        onTemplateCreated?.();
      } else {
        const errorMsg =
          responseData.error || responseData.message || 'Erro desconhecido';
        const detailsMsg = responseData.details
          ? `\n\nDetalhes: ${JSON.stringify(responseData.details, null, 2)}`
          : '';
        console.error('❌ Erro do backend:', responseData);
        alert(`❌ Erro ao criar template: ${errorMsg}${detailsMsg}`);
      }
    } catch (error) {
      console.error('❌ Erro ao criar template:', error);
      alert(
        `❌ Erro ao criar template: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      APPROVED: { color: 'bg-green-100 text-green-800', text: '✅ Aprovado' },
      PENDING: { color: 'bg-yellow-100 text-yellow-800', text: '⏳ Pendente' },
      REJECTED: { color: 'bg-red-100 text-red-800', text: '❌ Rejeitado' },
      PAUSED: { color: 'bg-orange-100 text-orange-800', text: '⏸️ Pausado' },
      DISABLED: {
        color: 'bg-neutral-100 text-neutral-800',
        text: '🚫 Desabilitado',
      },
    };

    const badge = badges[status] || {
      color: 'bg-neutral-100 text-neutral-800',
      text: status,
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-6 flex justify-between items-center">
          <Typography variant="h3" className="font-semibold">
            📄 Gerenciador de Templates
          </Typography>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showCreateForm ? (
            // Formulário de Criação
            <div className="space-y-4">
              <Form
                key={`create-template-${showCreateForm}`}
                zodSchema={createTemplateSchema}
                onSubmit={handleCreateTemplate}
                className="space-y-4"
              >
                <TemplateFormFields />
              </Form>
            </div>
          ) : (
            // Lista de Templates
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Typography variant="h5" className="font-semibold">
                    Templates Criados ({templates.length})
                  </Typography>
                  <Typography
                    variant="span"
                    className="text-sm text-neutral-600"
                  >
                    Mostrando todos os templates (aprovados, em análise,
                    rejeitados)
                  </Typography>
                </div>
                <div className="flex gap-2">
                  {/* <Button
                    variant="gradient"
                    onClick={loadTemplates}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Atualizando...</span>
                      </>
                    ) : (
                      'Atualizar'
                    )}
                  </Button> */}
                  {templates.length !== 0 ? (
                    <Button
                      variant="gradient"
                      onClick={() => setShowCreateForm(true)}
                      className="w-fit whitespace-nowrap"
                    >
                      <Plus size={16} className="mr-1" />
                      Novo Template
                    </Button>
                  ) : null}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <Loading
                    size="md"
                    variant="spinner"
                    text="Carregando templates..."
                  />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <Typography variant="p" className="mb-4">
                    Nenhum template encontrado
                  </Typography>
                  <Button
                    variant="gradient"
                    onClick={() => setShowCreateForm(true)}
                    className="w-fit whitespace-nowrap"
                  >
                    <Plus size={16} className="mr-1" />
                    Criar Primeiro Template
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Typography variant="h6" className="font-semibold">
                              {template.name}
                            </Typography>
                            {getStatusBadge(template.status)}
                          </div>
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-600"
                          >
                            {template.category} • {template.language}
                          </Typography>
                        </div>
                      </div>

                      {/* Informações adicionais: Recategorização, Qualidade, Rejeição */}
                      <div className="mt-2 space-y-2">
                        {/* Recategorização confirmada */}
                        {template.categoryUpdate &&
                          !template.categoryUpdate.reviewed && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                              <div className="flex items-start">
                                <span className="text-orange-600 mr-2">⚠️</span>
                                <div className="flex-1">
                                  <Typography
                                    variant="span"
                                    className="text-sm font-semibold text-orange-900 block mb-1"
                                  >
                                    Template foi recategorizado
                                  </Typography>
                                  <Typography
                                    variant="span"
                                    className="text-xs text-orange-800 block mb-2"
                                  >
                                    Este template foi recategorizado de{' '}
                                    <strong>
                                      {template.categoryUpdate.oldCategory ||
                                        'categoria desconhecida'}
                                    </strong>{' '}
                                    para{' '}
                                    <strong>
                                      {template.categoryUpdate.newCategory}
                                    </strong>{' '}
                                    em{' '}
                                    {new Date(
                                      template.categoryUpdate.updatedAt,
                                    ).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })}
                                    . Você tem 60 dias para revisar e fazer uma
                                    apelação.
                                  </Typography>
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      variant="ghost"
                                      className="text-xs h-7 border border-orange-300 hover:bg-orange-100 text-orange-800"
                                      onClick={async () => {
                                        try {
                                          const response = await fetch(
                                            `/api/whatsapp-templates/category-update/${template.categoryUpdate!.id}/review`,
                                            { method: 'POST' },
                                          );
                                          if (response.ok) {
                                            loadTemplates();
                                          }
                                        } catch (error) {
                                          console.error(
                                            'Erro ao marcar como revisado:',
                                            error,
                                          );
                                        }
                                      }}
                                    >
                                      Marcar como revisado
                                    </Button>
                                    <a
                                      href="https://business.facebook.com/help"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-orange-800 underline font-medium flex items-center"
                                    >
                                      Fazer apelação
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Recategorização já revisada */}
                        {template.categoryUpdate &&
                          template.categoryUpdate.reviewed && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-2 rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 text-xs">
                                  ℹ️
                                </span>
                                <Typography
                                  variant="span"
                                  className="text-xs text-blue-800"
                                >
                                  Recategorizado de{' '}
                                  <strong>
                                    {template.categoryUpdate.oldCategory ||
                                      'categoria desconhecida'}
                                  </strong>{' '}
                                  para{' '}
                                  <strong>
                                    {template.categoryUpdate.newCategory}
                                  </strong>
                                </Typography>
                              </div>
                            </div>
                          )}

                        {/* Motivo da rejeição */}
                        {template.status === 'REJECTED' &&
                          template.rejection_reason && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                              <div className="flex items-start">
                                <span className="text-red-600 mr-2">❌</span>
                                <div className="flex-1">
                                  <Typography
                                    variant="span"
                                    className="text-sm font-semibold text-red-900 block mb-1"
                                  >
                                    Motivo da Rejeição
                                  </Typography>
                                  <Typography
                                    variant="span"
                                    className="text-xs text-red-800"
                                  >
                                    {template.rejection_reason}
                                  </Typography>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Qualidade do template */}
                        {template.quality_score && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-neutral-500">Qualidade:</span>
                            <span
                              className={`font-medium ${
                                template.quality_score === 'GREEN'
                                  ? 'text-green-600'
                                  : template.quality_score === 'YELLOW'
                                    ? 'text-yellow-600'
                                    : template.quality_score === 'RED'
                                      ? 'text-red-600'
                                      : 'text-neutral-600'
                              }`}
                            >
                              {template.quality_score === 'GREEN' &&
                                '🟢 Excelente'}
                              {template.quality_score === 'YELLOW' && '🟡 Boa'}
                              {template.quality_score === 'RED' &&
                                '🔴 Precisa melhorar'}
                              {template.quality_score === 'UNKNOWN' &&
                                '⚪ Não avaliado'}
                            </span>
                          </div>
                        )}
                      </div>

                      {template.components.map((comp, idx) => {
                        if (comp.type === 'BODY' && comp.text) {
                          return (
                            <div
                              key={idx}
                              className="mt-3 p-3 bg-neutral-50 rounded text-sm"
                            >
                              <Typography className="whitespace-pre-wrap text-neutral-600">
                                {comp.text}
                              </Typography>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
