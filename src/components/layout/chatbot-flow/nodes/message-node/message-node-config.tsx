'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  MessageConfig,
  MessageType,
  InteractiveMenuType,
  MemoryItem,
} from '../../types';
import { Typography } from '@/components/ui/typography';
import { useInstances } from '@/lib/react-query/hooks/use-user';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { messageConfigSchema } from './message-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { InstanceProps } from '@/contexts/user/user-context.type';
// import { sendMessage } from '@/actions/uazapi/message';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CodeiumEditorField } from '@/components/ui/codeium-editor-field';
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { MemoryConfigSection } from '../memory-config-section';
import { cn } from '@/lib/utils';
import { TemplateManagerModal } from '@/components/features/whatsapp-templates/template-manager-modal';
import { Settings } from 'lucide-react';

interface MessageNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: MessageConfig;
  onSave: (config: MessageConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

const messageTypes: { value: MessageType; label: string }[] = [
  { value: 'text', label: '📝 Texto' },
  { value: 'media', label: '🖼️ Mídia' },
  { value: 'contact', label: '👤 Contato' },
  { value: 'location', label: '📍 Localização' },
  { value: 'interactive_menu', label: '📋 Menu Interativo' },
  { value: 'template', label: '📄 Template' },
];

// Modelo JSON de exemplo para cartões de carrossel
const JSON_CAROUSEL_TEMPLATE = `[
  {
    "title": "Produto Premium 1",
    "description": "Descrição detalhada do produto 1",
    "imageUrl": "https://exemplo.com/produto1.jpg",
    "buttons": [
      {
        "text": "Ver Detalhes",
        "actionType": "link",
        "id": "https://exemplo.com/produto1"
      },
      {
        "text": "Código Promocional",
        "actionType": "copy",
        "id": "PROMO123"
      },
      {
        "text": "Ligar para Vendas",
        "actionType": "call",
        "id": "+5511999999999"
      }
    ]
  },
  {
    "title": "Produto Premium 2",
    "description": "Descrição detalhada do produto 2",
    "imageUrl": "https://exemplo.com/produto2.jpg",
    "buttons": [
      {
        "text": "Comprar Agora",
        "actionType": "link",
        "id": "https://exemplo.com/comprar"
      },
      {
        "text": "Selecionar",
        "actionType": "return_id",
        "id": "produto_2"
      }
    ]
  }
  // Adicione mais cartões conforme necessário
]`;

// Modelo JSON de exemplo para lista com categorias
const JSON_LIST_TEMPLATE = `[
  {
    "category": "Eletrônicos",
    "items": [
      {
        "text": "Smartphones",
        "id": "phones",
        "description": "Últimos lançamentos em smartphones"
      },
      {
        "text": "Notebooks",
        "id": "laptops",
        "description": "Notebooks de alto desempenho"
      },
      {
        "text": "Tablets",
        "id": "tablets",
        "description": "Tablets para trabalho e lazer"
      }
    ]
  },
  {
    "category": "Acessórios",
    "items": [
      {
        "text": "Fones de Ouvido",
        "id": "headphones",
        "description": "Fones com cancelamento de ruído"
      },
      {
        "text": "Capas e Cases",
        "id": "cases",
        "description": "Proteção para seus dispositivos"
      }
    ]
  }
  // Adicione mais categorias conforme necessário
]`;

function MessageFormFields({
  instances,
  config,
  memoryItems,
  setMemoryItems,
  configMode,
  setConfigMode,
  jsonConfig,
  setJsonConfig,
  choices,
  setChoices,
  listCategories,
  setListCategories,
  carouselCards,
  setCarouselCards,
  setShowTemplateManager,
  setSelectedInstanceToken,
}: {
  instances: InstanceProps[];
  config?: MessageConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  configMode: 'manual' | 'json';
  setConfigMode: React.Dispatch<React.SetStateAction<'manual' | 'json'>>;
  jsonConfig: string;
  setJsonConfig: React.Dispatch<React.SetStateAction<string>>;
  choices: {
    id: string;
    text: string;
    description: string;
    actionType?: 'copy' | 'link' | 'call' | 'return_id';
  }[];
  setChoices: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        text: string;
        description: string;
        actionType?: 'copy' | 'link' | 'call' | 'return_id';
      }[]
    >
  >;
  listCategories: {
    id: string;
    name: string;
    items: {
      id: string;
      text: string;
      description: string;
      actionType?: 'copy' | 'link' | 'call' | 'return_id';
    }[];
  }[];
  setListCategories: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        name: string;
        items: {
          id: string;
          text: string;
          description: string;
          actionType?: 'copy' | 'link' | 'call' | 'return_id';
        }[];
      }[]
    >
  >;
  carouselCards: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    buttons: {
      id: string;
      text: string;
      description: string;
      actionType?: 'copy' | 'link' | 'call' | 'return_id';
    }[];
  }[];
  setCarouselCards: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        title: string;
        description: string;
        imageUrl: string;
        buttons: {
          id: string;
          text: string;
          description: string;
          actionType?: 'copy' | 'link' | 'call' | 'return_id';
        }[];
      }[]
    >
  >;
  setShowTemplateManager: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedInstanceToken: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { form, setValue, register } = useForm();
  // Refs para evitar loop infinito na sincronização
  const isUpdatingFromFormRef = useRef(false);
  const isUpdatingFromJsonConfigRef = useRef(false);
  const lastSyncedJsonConfigRef = useRef<string>(jsonConfig);
  const lastSyncedFormValueRef = useRef<string>('');
  const messageType = (form.messageType as MessageType) || 'text';
  const interactiveMenuType =
    (form.interactiveMenuType as InteractiveMenuType) || 'button';

  // Estado local para rastrear se o JSON foi editado manualmente
  const [jsonManuallyEdited, setJsonManuallyEdited] = useState(false);

  // Estados para templates (WhatsApp Cloud API)
  const [isCloudInstance, setIsCloudInstance] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      components: Array<{
        type: string;
        text?: string;
        example?: {
          body_text?: string[][];
          header_text?: string[];
        };
      }>;
      quality_score?: string;
      rejection_reason?: string;
    }>
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    (typeof templates)[0] | null
  >(null);
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    register('templateLanguage');
    register('templateVariables');
  }, [register]);

  // Gerenciar choices do menu interativo como objetos estruturados
  interface Choice {
    id: string;
    text: string;
    description: string;
    actionType?: 'copy' | 'link' | 'call' | 'return_id'; // Tipo de ação do botão
  }

  interface ListCategory {
    id: string;
    name: string;
    items: Choice[];
  }

  interface CarouselCard {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    buttons: Choice[];
  }

  // Estado para controlar quais categorias estão expandidas
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Função para alternar expansão de uma categoria
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Sincronizar JSON quando o modo mudar para JSON APENAS NA PRIMEIRA VEZ
  useEffect(() => {
    // Verificar se o JSON atual é uma variável dinâmica
    const isCurrentlyVariable = /^\{\{.+\}\}$/.test(jsonConfig.trim());

    // Não sobrescrever se já for uma variável dinâmica
    if (isCurrentlyVariable) {
      return;
    }

    // Não sobrescrever se o usuário já editou manualmente
    if (jsonManuallyEdited) {
      return;
    }

    if (
      configMode === 'json' &&
      interactiveMenuType === 'carousel' &&
      carouselCards.length > 0
    ) {
      setJsonConfig(JSON.stringify(carouselCards, null, 2));
    } else if (
      configMode === 'json' &&
      interactiveMenuType === 'list' &&
      listCategories.length > 0
    ) {
      // Converter listCategories para o formato JSON
      const listJson = listCategories.map((cat) => ({
        category: cat.name,
        items: cat.items.map((item) => ({
          text: item.text,
          id: item.id,
          description: item.description,
        })),
      }));
      setJsonConfig(JSON.stringify(listJson, null, 2));
    }
  }, [
    configMode,
    interactiveMenuType,
    carouselCards,
    listCategories,
    jsonManuallyEdited,
    jsonConfig,
    setJsonConfig,
  ]);

  // Resetar flag quando mudar de tipo de menu ou voltar para modo manual
  useEffect(() => {
    if (configMode === 'manual') {
      setJsonManuallyEdited(false);
    }
  }, [configMode, interactiveMenuType]);

  // Sincronizar jsonConfig com o campo do form para CodeiumEditorField
  useEffect(() => {
    // Evitar loop: se a mudança veio do form, não atualizar de volta
    if (isUpdatingFromFormRef.current) {
      return;
    }

    // Se jsonConfig não mudou desde a última sincronização, não fazer nada
    if (lastSyncedJsonConfigRef.current === jsonConfig) {
      return;
    }

    if (configMode === 'json') {
      if (interactiveMenuType === 'list') {
        const currentFormValue =
          (form.jsonConfigList as string | undefined) || '';
        const jsonConfigValue = jsonConfig || '';
        if (currentFormValue !== jsonConfigValue) {
          isUpdatingFromJsonConfigRef.current = true;
          setValue('jsonConfigList', jsonConfigValue);
          lastSyncedJsonConfigRef.current = jsonConfigValue;
          // Resetar flag no próximo tick
          requestAnimationFrame(() => {
            isUpdatingFromJsonConfigRef.current = false;
          });
        }
      } else if (interactiveMenuType === 'carousel') {
        const currentFormValue =
          (form.jsonConfigCarousel as string | undefined) || '';
        const jsonConfigValue = jsonConfig || '';
        if (currentFormValue !== jsonConfigValue) {
          isUpdatingFromJsonConfigRef.current = true;
          setValue('jsonConfigCarousel', jsonConfigValue);
          lastSyncedJsonConfigRef.current = jsonConfigValue;
          // Resetar flag no próximo tick
          requestAnimationFrame(() => {
            isUpdatingFromJsonConfigRef.current = false;
          });
        }
      }
    }
  }, [
    jsonConfig,
    configMode,
    interactiveMenuType,
    setValue,
    form.jsonConfigList,
    form.jsonConfigCarousel,
  ]);

  // Sincronizar mudanças do CodeiumEditorField de volta para jsonConfig
  useEffect(() => {
    // Evitar loop: se a mudança veio de jsonConfig, não atualizar de volta
    if (isUpdatingFromJsonConfigRef.current) {
      return;
    }

    if (configMode === 'json') {
      const formValue =
        interactiveMenuType === 'list'
          ? (form.jsonConfigList as string | undefined) || ''
          : interactiveMenuType === 'carousel'
            ? (form.jsonConfigCarousel as string | undefined) || ''
            : '';

      // Se o valor do form não mudou desde a última sincronização, não fazer nada
      if (lastSyncedFormValueRef.current === formValue) {
        return;
      }

      const jsonConfigValue = jsonConfig || '';

      // Aceitar valores vazios também (quando usuário apaga)
      if (formValue !== jsonConfigValue) {
        isUpdatingFromFormRef.current = true;
        setJsonConfig(formValue);
        setJsonManuallyEdited(true);
        lastSyncedFormValueRef.current = formValue;
        lastSyncedJsonConfigRef.current = formValue;
        // Resetar flag no próximo tick
        requestAnimationFrame(() => {
          isUpdatingFromFormRef.current = false;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.jsonConfigList,
    form.jsonConfigCarousel,
    configMode,
    interactiveMenuType,
  ]);

  // Atualizar campo do formulário quando JSON mudar (para passar validação Zod)
  useEffect(() => {
    if (
      configMode === 'json' &&
      (interactiveMenuType === 'carousel' || interactiveMenuType === 'list') &&
      jsonConfig.trim() !== ''
    ) {
      // Setar um valor dummy para passar a validação
      // O handleSubmit vai processar o JSON corretamente
      setValue('interactiveMenuChoices', '__JSON_MODE__');
    }
  }, [configMode, interactiveMenuType, jsonConfig, setValue]);

  // Detectar se a instância selecionada é Cloud API e buscar templates
  useEffect(() => {
    const selectedToken = form.token;
    if (!selectedToken) {
      setIsCloudInstance(false);
      setTemplates([]);
      // Se não há instância selecionada e o tipo é template, limpar
      if (form.messageType === 'template') {
        setValue('messageType', 'text');
        setValue('templateName', '');
        setValue('templateLanguage', '');
        setValue('templateVariables', '');
      }
      return;
    }

    const selectedInstance = instances.find(
      (inst) => inst.token === selectedToken,
    );
    const isCloud = !!(
      selectedInstance &&
      selectedInstance.plataform === 'cloud' &&
      selectedInstance.whatsapp_official_enabled
    );

    if (isCloud) {
      setIsCloudInstance(true);
      // Buscar templates
      setLoadingTemplates(true);
      fetch(`/api/whatsapp-templates?instanceToken=${selectedToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTemplates(data.data || []);
          }
        })
        .catch((err) => {
          console.error('Error fetching templates:', err);
        })
        .finally(() => {
          setLoadingTemplates(false);
        });
    } else {
      setIsCloudInstance(false);
      setTemplates([]);
      // Se mudou para instância não-Cloud e o tipo é template, limpar
      if (form.messageType === 'template') {
        setValue('messageType', 'text');
        setValue('templateName', '');
        setValue('templateLanguage', '');
        setValue('templateVariables', '');
        setSelectedTemplate(null);
        setTemplateVariables({});
      }
    }
  }, [form.token, form.messageType, instances, setValue]);

  // Detectar mudanças no template selecionado
  useEffect(() => {
    if (
      form.templateName &&
      templates.length > 0 &&
      form.messageType === 'template'
    ) {
      const template = templates.find((t) => t.name === form.templateName);
      setSelectedTemplate(template || null);
      if (template) {
        setValue('templateLanguage', template.language);
      }
    } else if (form.messageType !== 'template') {
      // Se não for template, limpar selectedTemplate
      setSelectedTemplate(null);
    }
  }, [form.templateName, form.messageType, templates, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        // Debug: verificar o que está sendo carregado
        console.log(
          '📥 Carregando config no MessageNodeConfig:',
          JSON.stringify(config, null, 2),
        );

        // Setar token primeiro - delay maior para garantir que FormSelect está completamente montado
        if (config.token) {
          setValue('token', config.token, { shouldValidate: false });
          setSelectedInstanceToken(config.token);
        }
        setValue('phoneNumber', config.phoneNumber || '');

        // IMPORTANTE: Setar messageType com shouldValidate e shouldDirty para garantir que o FormSelect atualize
        const messageTypeValue = config.messageType || 'text';
        console.log('📥 Setando messageType:', messageTypeValue);
        setValue('messageType', messageTypeValue, {
          shouldValidate: false,
          shouldDirty: false,
          shouldTouch: false,
        });

        // Forçar atualização do FormSelect após um pequeno delay
        setTimeout(() => {
          setValue('messageType', messageTypeValue, {
            shouldValidate: false,
            shouldDirty: false,
            shouldTouch: false,
          });
        }, 100);
        setValue('text', config.text || '');
        setValue('mediaUrl', config.mediaUrl || '');
        setValue('mediaType', config.mediaType || 'image');
        setValue('docName', config.docName || '');
        setValue('caption', config.caption || '');
        setValue('contactName', config.contactName || '');
        setValue('contactPhone', config.contactPhone || '');
        setValue('contactOrganization', config.contactOrganization || '');
        setValue('contactEmail', config.contactEmail || '');
        setValue('contactUrl', config.contactUrl || '');
        setValue('latitude', config.latitude?.toString() || '');
        setValue('longitude', config.longitude?.toString() || '');

        // Carregar opções avançadas
        setValue('linkPreview', config.linkPreview || false);
        setValue('linkPreviewTitle', config.linkPreviewTitle || '');
        setValue('linkPreviewDescription', config.linkPreviewDescription || '');
        setValue('linkPreviewImage', config.linkPreviewImage || '');
        setValue('linkPreviewLarge', config.linkPreviewLarge || false);
        setValue('replyId', config.replyId || '');
        setValue('mentions', config.mentions || '');
        setValue('readChat', config.readChat || false);
        setValue('readMessages', config.readMessages || false);
        setValue('delay', config.delay?.toString() || '');
        setValue('forward', config.forward || false);
        setValue('trackSource', config.trackSource || '');
        setValue('trackId', config.trackId || '');

        // Carregar configuração de template (WhatsApp Cloud API)
        if (config.templateName) {
          setValue('templateName', config.templateName);
          setValue('templateLanguage', config.templateLanguage || '');
          if (config.templateVariables) {
            setValue(
              'templateVariables',
              typeof config.templateVariables === 'string'
                ? config.templateVariables
                : JSON.stringify(config.templateVariables),
            );
            // Restaurar variáveis para o estado local
            setTemplateVariables(
              typeof config.templateVariables === 'string'
                ? JSON.parse(config.templateVariables)
                : config.templateVariables,
            );
          }
        }

        // Carregar configuração de menu interativo
        if (config.interactiveMenu) {
          setValue('interactiveMenuType', config.interactiveMenu.type);
          setValue('interactiveMenuText', config.interactiveMenu.text);
          setValue(
            'interactiveMenuFooter',
            config.interactiveMenu.footerText || '',
          );
          setValue(
            'interactiveMenuListButton',
            config.interactiveMenu.listButton || '',
          );
          setValue(
            'interactiveMenuImageButton',
            config.interactiveMenu.imageButton || '',
          );
          setValue(
            'interactiveMenuSelectableCount',
            config.interactiveMenu.selectableCount?.toString() || '1',
          );

          // Se for tipo "list", parsear com categorias hierárquicas
          if (config.interactiveMenu.type === 'list') {
            const rawChoices = config.interactiveMenu.choices || [];

            // Detectar se é uma variável dinâmica (regex mais abrangente)
            const isVariable =
              rawChoices.length === 1 &&
              typeof rawChoices[0] === 'string' &&
              /^\{\{.+\}\}$/.test(rawChoices[0].trim());

            if (isVariable) {
              // Carregar em modo JSON
              setConfigMode('json');
              setJsonConfig(rawChoices[0]);
            } else {
              // Parsear como categorias hierárquicas
              const categories: ListCategory[] = [];
              let currentCategory: ListCategory | null = null;

              rawChoices.forEach((choice) => {
                if (!choice || typeof choice !== 'string') return;

                // Se começa com [, é uma categoria
                if (choice.startsWith('[') && choice.endsWith(']')) {
                  const categoryName = choice.slice(1, -1);
                  currentCategory = {
                    id: crypto.randomUUID(),
                    name: categoryName,
                    items: [],
                  };
                  categories.push(currentCategory);
                } else {
                  // É um item da categoria
                  const parts = choice.split('|');
                  const item = {
                    text: parts[0] || '',
                    id: parts[1] || '',
                    description: parts[2] || '',
                  };

                  if (currentCategory) {
                    currentCategory.items.push(item);
                  } else {
                    // Se não há categoria, criar uma padrão
                    if (categories.length === 0) {
                      currentCategory = {
                        id: crypto.randomUUID(),
                        name: '',
                        items: [],
                      };
                      categories.push(currentCategory);
                    }
                    categories[0].items.push(item);
                  }
                }
              });

              setListCategories(
                categories.length > 0
                  ? categories
                  : [
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        items: [{ id: '', text: '', description: '' }],
                      },
                    ],
              );
            }
          } else if (config.interactiveMenu.type === 'carousel') {
            // Parsear carousel cards
            const rawChoices = config.interactiveMenu.choices || [];

            // Detectar se é uma variável dinâmica (regex mais abrangente)
            const isVariable =
              rawChoices.length === 1 &&
              typeof rawChoices[0] === 'string' &&
              /^\{\{.+\}\}$/.test(rawChoices[0].trim());

            if (isVariable) {
              // Carregar em modo JSON
              setConfigMode('json');
              setJsonConfig(rawChoices[0]);
            } else {
              // Parsear como cartões hierárquicos
              const cards: CarouselCard[] = [];
              let currentCard: CarouselCard | null = null;

              rawChoices.forEach((choice) => {
                if (!choice || typeof choice !== 'string') return;

                // Se começa com [, é um título de cartão (formato: [Título\nDescrição])
                if (choice.startsWith('[') && choice.endsWith(']')) {
                  const content = choice.slice(1, -1);
                  const parts = content.split('\n');
                  currentCard = {
                    id: crypto.randomUUID(),
                    title: parts[0] || '',
                    description: parts[1] || '',
                    imageUrl: '',
                    buttons: [],
                  };
                  cards.push(currentCard);
                } else if (choice.startsWith('{') && choice.endsWith('}')) {
                  // É a URL da imagem do cartão
                  if (currentCard) {
                    currentCard.imageUrl = choice.slice(1, -1);
                  }
                } else {
                  // É um botão do cartão
                  const parts = choice.split('|');
                  const rawId = parts[1] || '';

                  // Detectar tipo de ação
                  let actionType:
                    | 'copy'
                    | 'link'
                    | 'call'
                    | 'return_id'
                    | undefined = undefined;
                  let cleanId = rawId;

                  if (rawId.startsWith('copy:')) {
                    actionType = 'copy';
                    cleanId = rawId.replace('copy:', '');
                  } else if (rawId.startsWith('call:')) {
                    actionType = 'call';
                    cleanId = rawId.replace('call:', '');
                  } else if (rawId.startsWith('return_id:')) {
                    actionType = 'return_id';
                    cleanId = rawId.replace('return_id:', '');
                  } else if (rawId.startsWith('http')) {
                    actionType = 'link';
                    cleanId = rawId;
                  } else if (rawId && rawId.trim() !== '') {
                    // Se não tem prefixo mas tem valor, assumir que é return_id
                    actionType = 'return_id';
                    cleanId = rawId;
                  }

                  const button = {
                    text: parts[0] || '',
                    id: cleanId,
                    description: '',
                    actionType,
                  };

                  if (currentCard) {
                    currentCard.buttons.push(button);
                  }
                }
              });

              setCarouselCards(
                cards.length > 0
                  ? cards
                  : [
                      {
                        id: crypto.randomUUID(),
                        title: '',
                        description: '',
                        imageUrl: '',
                        buttons: [
                          {
                            id: '',
                            text: '',
                            description: '',
                            actionType: undefined,
                          },
                        ],
                      },
                    ],
              );

              // Definir valores dos FormSelects de actionType para carousel buttons
              cards.forEach((card) => {
                card.buttons.forEach((button, buttonIndex) => {
                  if (button.actionType) {
                    setValue(
                      `card_${card.id}_button_actionType_${buttonIndex}`,
                      button.actionType,
                    );
                  }
                });
              });
            }
          } else {
            // Para outros tipos (button, poll), usar o formato simples
            const parsedChoices = (config.interactiveMenu.choices || []).map(
              (choice) => {
                if (!choice || typeof choice !== 'string') {
                  return {
                    id: '',
                    text: '',
                    description: '',
                    actionType: undefined,
                  };
                }
                const parts = choice.split('|');
                const rawId = parts[1] || '';

                // Detectar tipo de ação
                let actionType:
                  | 'copy'
                  | 'link'
                  | 'call'
                  | 'return_id'
                  | undefined = undefined;
                let cleanId = rawId;

                if (rawId.startsWith('copy:')) {
                  actionType = 'copy';
                  cleanId = rawId.replace('copy:', '');
                } else if (rawId.startsWith('call:')) {
                  actionType = 'call';
                  cleanId = rawId.replace('call:', '');
                } else if (rawId.startsWith('return_id:')) {
                  actionType = 'return_id';
                  cleanId = rawId.replace('return_id:', '');
                } else if (rawId.startsWith('http')) {
                  actionType = 'link';
                  cleanId = rawId;
                } else if (rawId && rawId.trim() !== '') {
                  // Se não tem prefixo mas tem valor, assumir que é return_id
                  actionType = 'return_id';
                  cleanId = rawId;
                }

                return {
                  text: parts[0] || '',
                  id: cleanId,
                  description: parts[2] || '',
                  actionType,
                };
              },
            );
            setChoices(
              parsedChoices.length > 0
                ? parsedChoices
                : [
                    {
                      id: '',
                      text: '',
                      description: '',
                      actionType: undefined,
                    },
                  ],
            );

            // Definir valores dos FormSelects de actionType para buttons
            parsedChoices.forEach((choice, index) => {
              if (choice.actionType) {
                setValue(`choice_actionType_${index}`, choice.actionType);
              }
            });
          }

          setValue(
            'interactiveMenuChoices',
            JSON.stringify(config.interactiveMenu.choices || []),
          );
        }

        // Carregar configuração de memória
        if (config.memoryConfig) {
          setValue('memoryAction', config.memoryConfig.action || 'save');
          setValue('memoryName', config.memoryConfig.memoryName || '');
          setValue(
            'memorySaveMode',
            config.memoryConfig.saveMode || 'overwrite',
          );
          setValue(
            'memoryDefaultValue',
            config.memoryConfig.defaultValue || '',
          );

          // Carregar items de memória
          if (
            config.memoryConfig.items &&
            config.memoryConfig.items.length > 0
          ) {
            setMemoryItems(config.memoryConfig.items);
            setValue('memoryItems', config.memoryConfig.items);
          }

          // Carregar TTL
          if (config.memoryConfig.ttl) {
            const ttlString = String(config.memoryConfig.ttl);
            const ttlPresets = ['3600', '86400', '604800', '2592000'];
            if (ttlPresets.includes(ttlString)) {
              setValue('memoryTtlPreset', ttlString);
            } else {
              setValue('memoryTtlPreset', 'custom');
              setValue('memoryCustomTtl', ttlString);
            }
          } else {
            setValue('memoryTtlPreset', 'never');
          }
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [
    config,
    setCarouselCards,
    setChoices,
    setConfigMode,
    setJsonConfig,
    setListCategories,
    setMemoryItems,
    setSelectedInstanceToken,
    setValue,
  ]);

  // 🔧 CORREÇÃO: Sincronizar valores dos inputs com o formulário
  useEffect(() => {
    // Sincronizar choices (button, poll)
    if (interactiveMenuType === 'button' || interactiveMenuType === 'poll') {
      choices.forEach((choice, index) => {
        setValue(`choice_text_${index}`, choice.text);
        setValue(`choice_id_${index}`, choice.id);
        setValue(`choice_description_${index}`, choice.description);
        if (choice.actionType) {
          setValue(`choice_actionType_${index}`, choice.actionType);
        }
      });
    }

    // Sincronizar listCategories (list)
    if (interactiveMenuType === 'list') {
      listCategories.forEach((category) => {
        setValue(`category_name_${category.id}`, category.name);
        category.items.forEach((item, itemIndex) => {
          setValue(`category_${category.id}_item_text_${itemIndex}`, item.text);
          setValue(`category_${category.id}_item_id_${itemIndex}`, item.id);
          setValue(
            `category_${category.id}_item_desc_${itemIndex}`,
            item.description,
          );
        });
      });
    }

    // Sincronizar carouselCards (carousel)
    if (interactiveMenuType === 'carousel') {
      carouselCards.forEach((card) => {
        setValue(`card_title_${card.id}`, card.title);
        setValue(`card_description_${card.id}`, card.description);
        setValue(`card_image_${card.id}`, card.imageUrl);
        card.buttons.forEach((button, buttonIndex) => {
          setValue(`card_${card.id}_button_text_${buttonIndex}`, button.text);
          setValue(`card_${card.id}_button_id_${buttonIndex}`, button.id);
          if (button.actionType) {
            setValue(
              `card_${card.id}_button_actionType_${buttonIndex}`,
              button.actionType,
            );
          }
        });
      });
    }
  }, [choices, listCategories, carouselCards, interactiveMenuType, setValue]);

  // Atualizar choices no formulário quando mudar (converter para strings com pipe)
  useEffect(() => {
    // 🔒 PROTEÇÃO: Não sobrescrever se estiver em modo JSON com variável dinâmica
    if (
      configMode === 'json' &&
      (interactiveMenuType === 'list' || interactiveMenuType === 'carousel')
    ) {
      const isVariable = /^\{\{.+\}\}$/.test(jsonConfig.trim());
      if (isVariable) {
        return; // Não sobrescrever!
      }
    }

    if (interactiveMenuType === 'list') {
      // Para tipo "list", serializar categorias e itens em formato hierárquico
      const choicesStrings: string[] = [];

      listCategories.forEach((category) => {
        // Adicionar categoria se tiver nome
        if (category.name && category.name.trim() !== '') {
          choicesStrings.push(`[${category.name}]`);
        }

        // Adicionar itens da categoria
        category.items.forEach((item) => {
          if (item.text && item.text.trim() !== '') {
            choicesStrings.push(
              `${item.text}|${item.id || ''}|${item.description || ''}`,
            );
          }
        });
      });

      setValue('interactiveMenuChoices', JSON.stringify(choicesStrings));
    } else if (interactiveMenuType === 'carousel') {
      // Para tipo "carousel", serializar cartões e botões
      const choicesStrings: string[] = [];

      carouselCards.forEach((card) => {
        // Adicionar título e descrição do cartão (formato: [Título\nDescrição])
        if (card.title && card.title.trim() !== '') {
          const titleLine = card.description
            ? `[${card.title}\n${card.description}]`
            : `[${card.title}]`;
          choicesStrings.push(titleLine);
        }

        // Adicionar URL da imagem (formato: {URL})
        if (card.imageUrl && card.imageUrl.trim() !== '') {
          choicesStrings.push(`{${card.imageUrl}}`);
        }

        // Adicionar botões do cartão
        card.buttons.forEach((button) => {
          if (button.text && button.text.trim() !== '') {
            // Montar ID com prefixo baseado no actionType
            let finalId = button.id || '';
            if (button.actionType === 'copy') {
              finalId = `copy:${button.id}`;
            } else if (button.actionType === 'call') {
              finalId = `call:${button.id}`;
            } else if (button.actionType === 'return_id') {
              finalId = `${button.id}`;
            }
            // Para 'link', não adiciona prefixo (já é a URL completa)

            choicesStrings.push(`${button.text}|${finalId}`);
          }
        });
      });

      setValue('interactiveMenuChoices', JSON.stringify(choicesStrings));
    } else {
      // Para outros tipos (button, poll), usar o formato simples
      const choicesStrings = choices
        .map((choice) => {
          // Se não tiver texto, não incluir essa opção
          if (!choice.text || choice.text.trim() === '') return '';

          // Montar ID com prefixo baseado no actionType
          let finalId = choice.id || '';
          if (choice.actionType === 'copy') {
            finalId = `copy:${choice.id}`;
          } else if (choice.actionType === 'call') {
            finalId = `call:${choice.id}`;
          } else if (choice.actionType === 'return_id') {
            finalId = `${choice.id}`;
          }
          // Para 'link', não adiciona prefixo (já é a URL completa)

          // Montar string: texto|id|descrição
          // Sempre incluir os pipes, mesmo se id ou descrição estiverem vazios
          return `${choice.text}|${finalId}|${choice.description || ''}`;
        })
        .filter((str) => str !== ''); // Remover strings vazias

      setValue('interactiveMenuChoices', JSON.stringify(choicesStrings));
    }
  }, [
    choices,
    listCategories,
    carouselCards,
    interactiveMenuType,
    configMode,
    jsonConfig,
    setValue,
    setChoices,
    setListCategories,
    setCarouselCards,
  ]);

  // Funções para gerenciar choices simples (button, poll)
  const addChoice = () => {
    setChoices([
      ...choices,
      { id: '', text: '', description: '', actionType: undefined },
    ]);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 1) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const updateChoice = (
    index: number,
    field: 'id' | 'text' | 'description' | 'actionType',
    value: string,
  ) => {
    const newChoices = [...choices];
    newChoices[index] = {
      ...newChoices[index],
      [field]: value,
    };
    setChoices(newChoices);

    // Se for actionType, atualizar também o campo do formulário
    if (field === 'actionType') {
      setValue(`choice_actionType_${index}`, value);
    }
  };

  // Funções para gerenciar categorias (tipo list)
  const addCategory = () => {
    setListCategories([
      ...listCategories,
      {
        id: crypto.randomUUID(),
        name: '',
        items: [{ id: '', text: '', description: '', actionType: undefined }],
      },
    ]);
  };

  const removeCategory = (categoryId: string) => {
    if (listCategories.length > 1) {
      setListCategories(listCategories.filter((cat) => cat.id !== categoryId));
    }
  };

  const updateCategoryName = (categoryId: string, name: string) => {
    setListCategories(
      listCategories.map((cat) =>
        cat.id === categoryId ? { ...cat, name } : cat,
      ),
    );
  };

  const addItemToCategory = (categoryId: string) => {
    setListCategories(
      listCategories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: [
                ...cat.items,
                { id: '', text: '', description: '', actionType: undefined },
              ],
            }
          : cat,
      ),
    );
  };

  const removeItemFromCategory = (categoryId: string, itemIndex: number) => {
    setListCategories(
      listCategories.map((cat) => {
        if (cat.id === categoryId && cat.items.length > 1) {
          return {
            ...cat,
            items: cat.items.filter((_, i) => i !== itemIndex),
          };
        }
        return cat;
      }),
    );
  };

  const updateCategoryItem = (
    categoryId: string,
    itemIndex: number,
    field: 'id' | 'text' | 'description',
    value: string,
  ) => {
    setListCategories(
      listCategories.map((cat) => {
        if (cat.id === categoryId) {
          const newItems = [...cat.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            [field]: value,
          };
          return { ...cat, items: newItems };
        }
        return cat;
      }),
    );
  };

  // Funções para gerenciar carousel cards
  const addCarouselCard = () => {
    setCarouselCards([
      ...carouselCards,
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        imageUrl: '',
        buttons: [{ id: '', text: '', description: '', actionType: undefined }],
      },
    ]);
  };

  const removeCarouselCard = (cardId: string) => {
    if (carouselCards.length > 1) {
      setCarouselCards(carouselCards.filter((card) => card.id !== cardId));
    }
  };

  const updateCarouselCard = (
    cardId: string,
    field: 'title' | 'description' | 'imageUrl',
    value: string,
  ) => {
    setCarouselCards(
      carouselCards.map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card,
      ),
    );
  };

  const addButtonToCard = (cardId: string) => {
    setCarouselCards(
      carouselCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              buttons: [
                ...card.buttons,
                { id: '', text: '', description: '', actionType: undefined },
              ],
            }
          : card,
      ),
    );
  };

  const removeButtonFromCard = (cardId: string, buttonIndex: number) => {
    setCarouselCards(
      carouselCards.map((card) => {
        if (card.id === cardId && card.buttons.length > 1) {
          return {
            ...card,
            buttons: card.buttons.filter((_, i) => i !== buttonIndex),
          };
        }
        return card;
      }),
    );
  };

  const updateCardButton = (
    cardId: string,
    buttonIndex: number,
    field: 'id' | 'text' | 'actionType',
    value: string,
  ) => {
    setCarouselCards(
      carouselCards.map((card) => {
        if (card.id === cardId) {
          const newButtons = [...card.buttons];
          newButtons[buttonIndex] = {
            ...newButtons[buttonIndex],
            [field]: value,
          };
          return { ...card, buttons: newButtons };
        }
        return card;
      }),
    );

    // Se for actionType, atualizar também o campo do formulário
    if (field === 'actionType') {
      setValue(`card_${cardId}_button_actionType_${buttonIndex}`, value);
    }
  };

  return (
    <>
      {/* Instância */}
      <div className="p-1">
        <FormControl variant="label">Instância</FormControl>
        <FormSelect
          fieldName="token"
          placeholder="Selecione uma instância"
          options={instances.map((instance) => ({
            value: instance.token,
            label: instance.name || instance.profileName || instance.id,
          }))}
          className="w-full"
          onValueChange={(value) => {
            setSelectedInstanceToken(value);
          }}
        />
      </div>

      {/* Número de Celular */}
      <div className="p-1">
        <FormControl variant="label">Número do Celular</FormControl>
        <Input type="tel" fieldName="phoneNumber" placeholder="5511999999999" />
      </div>

      {/* Tipo de Mensagem */}
      <div className="p-1">
        <FormControl variant="label">Tipo de Mensagem</FormControl>
        <FormSelect
          fieldName="messageType"
          placeholder="Selecione o tipo"
          options={messageTypes.filter((type) => {
            // Mostrar template apenas se a instância for Cloud
            if (type.value === 'template') {
              return isCloudInstance;
            }
            return true;
          })}
          className="w-full"
          onValueChange={(value) => {
            // Garantir que o valor seja salvo
            setValue('messageType', value);
            // Se mudou para template e já existe um templateName, atualizar selectedTemplate
            if (
              value === 'template' &&
              form.templateName &&
              templates.length > 0
            ) {
              const template = templates.find(
                (t) => t.name === form.templateName,
              );
              if (template) {
                setSelectedTemplate(template);
                setValue('templateLanguage', template.language);
              }
            } else if (value !== 'template') {
              // Se mudou para outro tipo, limpar template
              setSelectedTemplate(null);
            }
          }}
        />
      </div>

      {/* Campos específicos por tipo */}
      {messageType === 'text' && (
        <>
          <div className="p-1">
            <FormControl variant="label">Mensagem</FormControl>
            <Textarea
              fieldName="text"
              placeholder="Digite a mensagem que será enviada..."
              rows={6}
            />
          </div>

          {/* Opções Avançadas */}
          <div className="border-t pt-4 mt-4">
            <Typography variant="h5" className="font-semibold mb-3">
              ⚙️ Opções Avançadas
            </Typography>

            {/* Link Preview */}
            <div className="space-y-3 p-3 bg-neutral-50 rounded-lg mb-3">
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="linkPreview"
                  onChange={(e) => setValue('linkPreview', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl
                  variant="label"
                  className="text-sm font-medium cursor-pointer"
                >
                  Ativar preview de links
                </FormControl>
              </div>
              <Typography variant="span" className="text-xs text-neutral-600">
                Gera preview automático do primeiro link encontrado no texto
              </Typography>

              {form.linkPreview && (
                <div className="space-y-2 pl-6 border-l-2 border-gray-300">
                  <div className="p-1">
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Título do Preview (opcional)
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName="linkPreviewTitle"
                      placeholder="Título Personalizado"
                    />
                  </div>
                  <div className="p-1">
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Descrição do Preview (opcional)
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName="linkPreviewDescription"
                      placeholder="Descrição personalizada do link"
                    />
                  </div>
                  <div className="p-1">
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Imagem do Preview (opcional)
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName="linkPreviewImage"
                      placeholder="https://exemplo.com/imagem.jpg ou Base64"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      fieldName="linkPreviewLarge"
                      onChange={(e) =>
                        setValue('linkPreviewLarge', e.target.checked)
                      }
                      className="bg-neutral-200"
                    />
                    <FormControl
                      variant="label"
                      className="text-sm cursor-pointer"
                    >
                      Preview grande (com upload da imagem)
                    </FormControl>
                  </div>
                </div>
              )}
            </div>

            {/* Responder Mensagem */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  ID da mensagem para responder (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="replyId"
                placeholder="3EB0538DA65A59F6D8A251"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                ID da mensagem que será respondida
              </Typography>
            </div>

            {/* Menções */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Menções (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="mentions"
                placeholder="5511999999999,5511888888888"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Números para mencionar, separados por vírgula
              </Typography>
            </div>

            {/* Checkboxes de leitura e encaminhamento */}
            <div className="space-y-2 p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="readChat"
                  onChange={(e) => setValue('readChat', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl variant="label" className="text-sm cursor-pointer">
                  Marcar conversa como lida após envio
                </FormControl>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="readMessages"
                  onChange={(e) => setValue('readMessages', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl variant="label" className="text-sm cursor-pointer">
                  Marcar últimas mensagens recebidas como lidas
                </FormControl>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="forward"
                  onChange={(e) => setValue('forward', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl variant="label" className="text-sm cursor-pointer">
                  Marcar mensagem como encaminhada
                </FormControl>
              </div>
            </div>

            {/* Delay */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Atraso antes do envio (opcional)
                </Typography>
              </FormControl>
              <Input type="number" fieldName="delay" placeholder="1000" />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Tempo em milissegundos. Durante o atraso aparecerá
                &quot;Digitando...&quot;
              </Typography>
            </div>

            {/* Rastreamento */}
            <div className="space-y-3 p-3 bg-gray-50/40 rounded-lg">
              <Typography variant="span" className="text-sm font-medium">
                Rastreamento
              </Typography>
              <div className="p-1">
                <FormControl variant="label">
                  <Typography variant="span" className="text-sm">
                    Origem (opcional)
                  </Typography>
                </FormControl>
                <Input
                  type="text"
                  fieldName="trackSource"
                  placeholder="chatwoot"
                />
              </div>
              <div className="p-1">
                <FormControl variant="label">
                  <Typography variant="span" className="text-sm">
                    ID de rastreamento (opcional)
                  </Typography>
                </FormControl>
                <Input
                  type="text"
                  fieldName="trackId"
                  placeholder="msg_123456789"
                />
                <Typography
                  variant="span"
                  className="text-xs text-neutral-600 mt-1"
                >
                  Aceita valores duplicados
                </Typography>
              </div>
            </div>
          </div>
        </>
      )}

      {messageType === 'media' && (
        <div className="space-y-3">
          <div className="p-1">
            <FormControl variant="label">Tipo de Mídia *</FormControl>
            <FormSelect
              fieldName="mediaType"
              placeholder="Selecione o tipo"
              options={[
                { value: 'image', label: '🖼️ Imagem (JPG, PNG)' },
                { value: 'video', label: '🎥 Vídeo (MP4)' },
                { value: 'document', label: '📄 Documento (PDF, DOCX, etc)' },
                { value: 'audio', label: '🎵 Áudio (MP3, OGG)' },
                {
                  value: 'myaudio',
                  label: '🎤 Mensagem de Voz (alternativa ao PTT)',
                },
                { value: 'ptt', label: '🎙️ Mensagem de Voz (Push-to-Talk)' },
                { value: 'sticker', label: '😄 Figurinha/Sticker' },
              ]}
              className="w-full"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Selecione o tipo de arquivo que será enviado
            </Typography>
          </div>
          <div className="p-1">
            <FormControl variant="label">URL da Mídia ou Base64 *</FormControl>
            <Input
              type="text"
              fieldName="mediaUrl"
              placeholder="https://exemplo.com/imagem.jpg ou data:image/jpeg;base64,..."
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              URL pública do arquivo ou conteúdo em base64
            </Typography>
          </div>
          {form.mediaType === 'document' && (
            <div className="p-1">
              <FormControl variant="label">
                Nome do Arquivo (opcional)
              </FormControl>
              <Input
                type="text"
                fieldName="docName"
                placeholder="relatorio.pdf"
              />
              <Typography variant="span" className="text-xs text-gray-500 mt-1">
                Nome que será exibido para o documento
              </Typography>
            </div>
          )}
          <div className="p-1">
            <FormControl variant="label">
              Legenda/Caption (opcional)
            </FormControl>
            <Textarea
              fieldName="caption"
              placeholder="Texto descritivo da mídia..."
              rows={3}
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Texto que acompanha a mídia (suporta variáveis)
            </Typography>
          </div>
        </div>
      )}

      {messageType === 'contact' && (
        <div className="space-y-3">
          <div className="p-1">
            <FormControl variant="label">Nome Completo *</FormControl>
            <Input
              type="text"
              fieldName="contactName"
              placeholder="João Silva"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Nome completo do contato no vCard
            </Typography>
          </div>
          <div className="p-1">
            <FormControl variant="label">Telefone(s) *</FormControl>
            <Input
              type="text"
              fieldName="contactPhone"
              placeholder="5511999999999,5511888888888"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Um ou mais números separados por vírgula
            </Typography>
          </div>
          <div className="p-1">
            <FormControl variant="label">
              Organização/Empresa (opcional)
            </FormControl>
            <Input
              type="text"
              fieldName="contactOrganization"
              placeholder="Empresa XYZ"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Nome da organização ou empresa
            </Typography>
          </div>
          <div className="p-1">
            <FormControl variant="label">Email (opcional)</FormControl>
            <Input
              type="email"
              fieldName="contactEmail"
              placeholder="joao.silva@empresa.com"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Endereço de email do contato
            </Typography>
          </div>
          <div className="p-1">
            <FormControl variant="label">URL (opcional)</FormControl>
            <Input
              type="url"
              fieldName="contactUrl"
              placeholder="https://empresa.com/joao"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Website pessoal ou da empresa
            </Typography>
          </div>
        </div>
      )}

      {messageType === 'location' && (
        <div className="space-y-3">
          <div>
            <FormControl variant="label">Latitude</FormControl>
            <Input type="text" fieldName="latitude" placeholder="-23.550520" />
          </div>
          <div>
            <FormControl variant="label">Longitude</FormControl>
            <Input type="text" fieldName="longitude" placeholder="-46.633308" />
          </div>
        </div>
      )}

      {messageType === 'interactive_menu' && (
        <div className="space-y-4 border-t pt-4">
          <Typography variant="h5" className="font-semibold">
            Configuração de Menu Interativo
          </Typography>

          {/* Tipo de Menu */}
          <div className="p-1">
            <FormControl variant="label">Tipo de Menu *</FormControl>
            <FormSelect
              fieldName="interactiveMenuType"
              placeholder="Selecione o tipo"
              options={[
                { value: 'button', label: 'Botões' },
                { value: 'list', label: 'Lista' },
                { value: 'poll', label: 'Enquete' },
                { value: 'carousel', label: 'Carrossel' },
              ]}
              className="w-full"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              {interactiveMenuType === 'button' &&
                'Cria botões de resposta, URL, chamada ou cópia'}
              {interactiveMenuType === 'list' &&
                'Cria um menu organizado em seções'}
              {interactiveMenuType === 'poll' &&
                'Cria uma enquete para votação'}
              {interactiveMenuType === 'carousel' &&
                'Cria um carrossel de cartões com imagens'}
            </Typography>
          </div>

          {/* Texto Principal */}
          <div className="p-1">
            <FormControl variant="label">Texto Principal *</FormControl>
            <Textarea
              fieldName="interactiveMenuText"
              placeholder="Digite o texto da mensagem..."
              rows={3}
            />
          </div>

          {/* Choices */}
          <div className="p-1">
            {(interactiveMenuType === 'list' ||
              interactiveMenuType === 'carousel') && (
              <div className="flex items-center justify-between gap-2 relative mt-4">
                <FormControl variant="label">
                  {interactiveMenuType === 'list'
                    ? 'Categorias e Opções *'
                    : 'Cartões *'}{' '}
                </FormControl>
                <Button
                  type="button"
                  variant="gradient"
                  onClick={
                    interactiveMenuType === 'list'
                      ? addCategory
                      : addCarouselCard
                  }
                  className="w-fit gap-2 absolute right-0 -top-5"
                >
                  <Plus className="w-4 h-4" />
                  {interactiveMenuType === 'list'
                    ? 'Adicionar Nova Categoria'
                    : 'Adicionar Novo Cartão'}
                </Button>
              </div>
            )}

            {/* UI Hierárquica para tipo LIST */}
            {interactiveMenuType === 'list' ? (
              <div className="space-y-4 mt-2">
                {/* Toggle entre modo Manual e JSON para Lista */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <Typography
                        variant="span"
                        className="text-sm font-medium"
                      >
                        Modo de Configuração das Categorias
                      </Typography>
                      <Typography
                        variant="span"
                        className="text-xs text-neutral-600"
                      >
                        {configMode === 'manual'
                          ? 'Configure através da interface visual'
                          : 'Configure através de JSON'}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-neutral-300">
                      <Button
                        type="button"
                        variant={configMode === 'manual' ? 'gradient' : 'ghost'}
                        onClick={() => setConfigMode('manual')}
                        className={cn(
                          'w-fit px-4 py-2 text-sm',
                          configMode === 'manual'
                            ? '!text-white'
                            : '!text-neutral-600',
                        )}
                      >
                        Manual
                      </Button>
                      <Button
                        type="button"
                        variant={configMode === 'json' ? 'gradient' : 'ghost'}
                        onClick={() => setConfigMode('json')}
                        className={cn(
                          'w-fit px-4 py-2 text-sm',
                          configMode !== 'manual'
                            ? '!text-white'
                            : '!text-neutral-600',
                        )}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                </div>

                {configMode === 'json' ? (
                  // Modo JSON para Lista
                  <div>
                    <div className="flex items-center justify-between relative !pt-4">
                      <FormControl variant="label">
                        Configuração JSON das Categorias
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setJsonConfig(JSON_LIST_TEMPLATE);
                          setValue('jsonConfigList', JSON_LIST_TEMPLATE);
                        }}
                        className="absolute right-0 top-0 w-fit text-sm text-blue-600 hover:text-blue-700"
                      >
                        📄 Carregar Modelo de Exemplo
                      </Button>
                    </div>
                    <CodeiumEditorField
                      fieldName="jsonConfigList"
                      language="json"
                      placeholder="Cole ou edite o JSON de configuração aqui..."
                      height="400px"
                      theme="light"
                      backgroundColor="#ffffff"
                    />
                  </div>
                ) : (
                  // Modo Manual para Lista
                  <div className="space-y-4">
                    {listCategories.map((category, catIndex) => {
                      const isExpanded = expandedCategories.has(category.id);

                      return (
                        <div
                          key={category.id}
                          className="border border-neutral-200 rounded-lg bg-white"
                        >
                          {/* Header da Categoria - Sempre visível */}
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  toggleCategoryExpansion(category.id)
                                }
                                className="h-fit w-fit p-1 hover:bg-neutral-100"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-neutral-400" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                                )}
                              </Button>
                              <div className="flex flex-col flex-1">
                                <Typography
                                  variant="span"
                                  className="text-sm text-neutral-700"
                                >
                                  Categoria {catIndex + 1}
                                </Typography>
                                {category.name && (
                                  <Typography
                                    variant="span"
                                    className="text-xs text-neutral-500"
                                  >
                                    {category.name}
                                  </Typography>
                                )}
                              </div>
                            </div>
                            {listCategories?.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeCategory(category.id)}
                                disabled={listCategories.length === 1}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 h-fit w-fit"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          {/* Conteúdo da Categoria - Colapsável */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-neutral-200 pt-4">
                              {/* Nome da Categoria */}
                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-sm"
                                  >
                                    Nome da Categoria{' '}
                                    <Typography
                                      variant="span"
                                      className="text-xs text-gray-500 font-normal"
                                    >
                                      (opcional)
                                    </Typography>
                                  </Typography>
                                </FormControl>
                                <Input
                                  type="text"
                                  fieldName={`category_name_${category.id}`}
                                  onChange={(e) =>
                                    updateCategoryName(
                                      category.id,
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Ex: Eletrônicos, Acessórios, etc"
                                />
                              </div>

                              {/* Itens da Categoria */}
                              <div className="space-y-2 ml-4 pl-4 border-l-2 border-neutral-300">
                                <Typography
                                  variant="span"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Opções da categoria:
                                </Typography>
                                {category.items.map((item, itemIndex) => (
                                  <div
                                    key={itemIndex}
                                    className="p-3 border border-gray-300 rounded-lg bg-white space-y-2"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <Typography
                                        variant="span"
                                        className="text-sm font-semibold text-neutral-600"
                                      >
                                        Opção {itemIndex + 1}
                                      </Typography>
                                      {category.items.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          onClick={() =>
                                            removeItemFromCategory(
                                              category.id,
                                              itemIndex,
                                            )
                                          }
                                          disabled={category.items.length === 1}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>

                                    <div>
                                      <FormControl variant="label">
                                        <Typography
                                          variant="span"
                                          className="text-sm"
                                        >
                                          Texto *
                                        </Typography>
                                      </FormControl>
                                      <Input
                                        type="text"
                                        fieldName={`category_${category.id}_item_text_${itemIndex}`}
                                        onChange={(e) =>
                                          updateCategoryItem(
                                            category.id,
                                            itemIndex,
                                            'text',
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Ex: Smartphones"
                                      />
                                    </div>

                                    <div>
                                      <FormControl variant="label">
                                        <Typography
                                          variant="span"
                                          className="text-sm"
                                        >
                                          ID
                                        </Typography>
                                      </FormControl>
                                      <Input
                                        type="text"
                                        fieldName={`category_${category.id}_item_id_${itemIndex}`}
                                        onChange={(e) =>
                                          updateCategoryItem(
                                            category.id,
                                            itemIndex,
                                            'id',
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Ex: phones"
                                      />
                                    </div>

                                    <div>
                                      <FormControl variant="label">
                                        <Typography
                                          variant="span"
                                          className="text-sm"
                                        >
                                          Descrição
                                        </Typography>
                                      </FormControl>
                                      <Input
                                        type="text"
                                        fieldName={`category_${category.id}_item_desc_${itemIndex}`}
                                        onChange={(e) =>
                                          updateCategoryItem(
                                            category.id,
                                            itemIndex,
                                            'description',
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Ex: Últimos lançamentos"
                                      />
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="default"
                                  onClick={() => addItemToCategory(category.id)}
                                  className="w-full gap-2 text-sm"
                                >
                                  <Plus className="w-3 h-3" />
                                  Adicionar Item nesta Categoria
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : interactiveMenuType === 'carousel' ? (
              // UI Hierárquica para tipo CAROUSEL
              <div className="space-y-4 mt-2">
                {/* Toggle entre modo Manual e JSON para Carrossel */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <Typography
                        variant="span"
                        className="text-sm font-medium"
                      >
                        Modo de Configuração dos Cartões
                      </Typography>
                      <Typography
                        variant="span"
                        className="text-xs text-neutral-600"
                      >
                        {configMode === 'manual'
                          ? 'Configure através da interface visual'
                          : 'Configure através de JSON'}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-neutral-300">
                      <Button
                        type="button"
                        variant={configMode === 'manual' ? 'gradient' : 'ghost'}
                        onClick={() => setConfigMode('manual')}
                        className={cn(
                          'w-fit px-4 py-2 text-sm',
                          configMode === 'manual'
                            ? '!text-white'
                            : '!text-neutral-600',
                        )}
                      >
                        Manual
                      </Button>
                      <Button
                        type="button"
                        variant={configMode === 'json' ? 'gradient' : 'ghost'}
                        onClick={() => setConfigMode('json')}
                        className={cn(
                          'w-fit px-4 py-2 text-sm',
                          configMode !== 'manual'
                            ? '!text-white'
                            : '!text-neutral-600',
                        )}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                </div>

                {configMode === 'json' ? (
                  // Modo JSON para Carrossel
                  <div>
                    <div className="flex items-center justify-between relative pt-4">
                      <FormControl variant="label">
                        Configuração JSON dos Cartões
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setJsonConfig(JSON_CAROUSEL_TEMPLATE);
                          setValue(
                            'jsonConfigCarousel',
                            JSON_CAROUSEL_TEMPLATE,
                          );
                        }}
                        className="w-fit text-sm text-blue-600 hover:text-blue-700 absolute top-0 right-0"
                      >
                        📄 Carregar Modelo de Exemplo
                      </Button>
                    </div>
                    <CodeiumEditorField
                      fieldName="jsonConfigCarousel"
                      language="json"
                      placeholder="Cole ou edite o JSON de configuração aqui..."
                      height="400px"
                      theme="light"
                      backgroundColor="#ffffff"
                    />
                  </div>
                ) : (
                  // Modo Manual para Carrossel
                  <div className="space-y-4">
                    {carouselCards.map((card, cardIndex) => (
                      <div
                        key={card.id}
                        className="p-4 border-2 border-neutral-200 rounded-lg bg-white"
                      >
                        {/* Header do Cartão */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex flex-1 flex-col space-y-3">
                            <div className="flex items-center justify-between gap-2 relative">
                              <FormControl variant="label" className="mb-2">
                                <Typography
                                  variant="span"
                                  className="font-semibold"
                                >
                                  🎴 Cartão {cardIndex + 1}
                                </Typography>
                              </FormControl>
                              {carouselCards?.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => removeCarouselCard(card.id)}
                                  disabled={carouselCards.length === 1}
                                  className="absolute right-0 -top-3 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 h-fit w-fit"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* Título do Cartão */}
                            <div>
                              <FormControl variant="label">
                                <Typography variant="span" className="text-sm">
                                  Título *
                                </Typography>
                              </FormControl>
                              <Input
                                type="text"
                                fieldName={`card_title_${card.id}`}
                                onChange={(e) =>
                                  updateCarouselCard(
                                    card.id,
                                    'title',
                                    e.target.value,
                                  )
                                }
                                placeholder="Ex: Smartphone XYZ"
                              />
                            </div>

                            {/* Descrição do Cartão */}
                            <div>
                              <FormControl variant="label">
                                <Typography variant="span" className="text-sm">
                                  Descrição{' '}
                                  <Typography
                                    variant="span"
                                    className="text-xs text-gray-500 font-normal"
                                  >
                                    (opcional)
                                  </Typography>
                                </Typography>
                              </FormControl>
                              <Textarea
                                fieldName={`card_description_${card.id}`}
                                onChange={(e) =>
                                  updateCarouselCard(
                                    card.id,
                                    'description',
                                    e.target.value,
                                  )
                                }
                                placeholder="Ex: O mais avançado smartphone da linha"
                                rows={2}
                              />
                            </div>

                            {/* URL da Imagem */}
                            <div>
                              <FormControl variant="label">
                                <Typography variant="span" className="text-sm">
                                  URL da Imagem *
                                </Typography>
                              </FormControl>
                              <Input
                                type="url"
                                fieldName={`card_image_${card.id}`}
                                onChange={(e) =>
                                  updateCarouselCard(
                                    card.id,
                                    'imageUrl',
                                    e.target.value,
                                  )
                                }
                                placeholder="https://exemplo.com/produto.jpg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Botões do Cartão */}
                        <div className="space-y-2 ml-4 pl-4 border-l-2 border-neutral-300">
                          <Typography
                            variant="span"
                            className="text-sm font-medium text-gray-700"
                          >
                            Botões do cartão:
                          </Typography>
                          {card.buttons.map((button, buttonIndex) => (
                            <div
                              key={buttonIndex}
                              className="p-3 border border-gray-300 rounded-lg bg-white space-y-2"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Typography
                                  variant="span"
                                  className="text-sm font-semibold text-neutral-600"
                                >
                                  Botão {buttonIndex + 1}
                                </Typography>
                                {card.buttons?.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      removeButtonFromCard(card.id, buttonIndex)
                                    }
                                    disabled={card.buttons.length === 1}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>

                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-sm"
                                  >
                                    Texto do Botão *
                                  </Typography>
                                </FormControl>
                                <Input
                                  type="text"
                                  fieldName={`card_${card.id}_button_text_${buttonIndex}`}
                                  onChange={(e) =>
                                    updateCardButton(
                                      card.id,
                                      buttonIndex,
                                      'text',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Ex: Copiar Código"
                                />
                              </div>

                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-sm"
                                  >
                                    Tipo de Ação *
                                  </Typography>
                                </FormControl>
                                <FormSelect
                                  fieldName={`card_${card.id}_button_actionType_${buttonIndex}`}
                                  placeholder="Selecione o tipo"
                                  options={[
                                    { value: 'copy', label: '📋 Copiar' },
                                    { value: 'link', label: '🔗 Link' },
                                    { value: 'call', label: '📞 Ligação' },
                                    {
                                      value: 'return_id',
                                      label: '🔄 Retornar Identificador',
                                    },
                                  ]}
                                  onValueChange={(value) =>
                                    updateCardButton(
                                      card.id,
                                      buttonIndex,
                                      'actionType',
                                      value,
                                    )
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-sm"
                                  >
                                    {button.actionType === 'copy' &&
                                      'Código para Copiar *'}
                                    {button.actionType === 'link' &&
                                      'URL do Link *'}
                                    {button.actionType === 'call' &&
                                      'Número para Ligar *'}
                                    {button.actionType === 'return_id' &&
                                      'Identificador *'}
                                    {!button.actionType && 'Valor *'}
                                  </Typography>
                                </FormControl>
                                <Input
                                  type="text"
                                  fieldName={`card_${card.id}_button_id_${buttonIndex}`}
                                  onChange={(e) =>
                                    updateCardButton(
                                      card.id,
                                      buttonIndex,
                                      'id',
                                      e.target.value,
                                    )
                                  }
                                  placeholder={
                                    button.actionType === 'copy'
                                      ? 'Ex: PROMO123'
                                      : button.actionType === 'link'
                                        ? 'Ex: https://exemplo.com'
                                        : button.actionType === 'call'
                                          ? 'Ex: +5511999999999'
                                          : button.actionType === 'return_id'
                                            ? 'Ex: etapa_1'
                                            : 'Selecione o tipo de ação primeiro'
                                  }
                                />
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="default"
                            onClick={() => addButtonToCard(card.id)}
                            className="w-full gap-2 text-sm"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar Botão neste Cartão
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // UI Simples para outros tipos (button, poll)
              <div className="space-y-3 mt-4">
                <FormControl variant="label">Opções *</FormControl>
                {choices.map((choice, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 rounded-lg bg-neutral-50 space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Typography
                        variant="span"
                        className="text-sm font-medium text-gray-700"
                      >
                        Opção {index + 1}
                      </Typography>
                      {choices?.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeChoice(index)}
                          disabled={choices.length === 1}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div>
                      <FormControl variant="label">
                        <Typography variant="span" className="text-sm">
                          Texto *
                        </Typography>
                      </FormControl>
                      <Input
                        type="text"
                        fieldName={`choice_text_${index}`}
                        onChange={(e) =>
                          updateChoice(index, 'text', e.target.value)
                        }
                        placeholder={
                          interactiveMenuType === 'button'
                            ? 'Ex: Suporte Técnico'
                            : 'Ex: Manhã (8h-12h)'
                        }
                      />
                    </div>

                    {interactiveMenuType === 'button' && (
                      <>
                        <div>
                          <FormControl variant="label">
                            <Typography variant="span" className="text-sm">
                              Tipo de Ação *
                            </Typography>
                          </FormControl>
                          <FormSelect
                            fieldName={`choice_actionType_${index}`}
                            placeholder="Selecione o tipo"
                            options={[
                              { value: 'copy', label: '📋 Copiar' },
                              { value: 'link', label: '🔗 Link' },
                              { value: 'call', label: '📞 Ligação' },
                              {
                                value: 'return_id',
                                label: '🔄 Retornar Identificador',
                              },
                            ]}
                            onValueChange={(value) =>
                              updateChoice(index, 'actionType', value)
                            }
                            className="w-full"
                          />
                        </div>

                        <div>
                          <FormControl variant="label">
                            <Typography variant="span" className="text-sm">
                              {choice.actionType === 'copy' &&
                                'Código para Copiar *'}
                              {choice.actionType === 'link' && 'URL do Link *'}
                              {choice.actionType === 'call' &&
                                'Número para Ligar *'}
                              {choice.actionType === 'return_id' &&
                                'Identificador *'}
                              {!choice.actionType && 'Valor *'}
                            </Typography>
                          </FormControl>
                          <Input
                            type="text"
                            fieldName={`choice_id_${index}`}
                            onChange={(e) =>
                              updateChoice(index, 'id', e.target.value)
                            }
                            placeholder={
                              choice.actionType === 'copy'
                                ? 'Ex: PROMO123'
                                : choice.actionType === 'link'
                                  ? 'Ex: https://exemplo.com'
                                  : choice.actionType === 'call'
                                    ? 'Ex: +5511999999999'
                                    : choice.actionType === 'return_id'
                                      ? 'Ex: etapa_1'
                                      : 'Selecione o tipo de ação primeiro'
                            }
                          />
                        </div>
                      </>
                    )}

                    {interactiveMenuType === 'button' && (
                      <div>
                        <FormControl variant="label">
                          <Typography variant="span" className="text-sm">
                            Descrição{' '}
                            <Typography
                              variant="span"
                              className="text-xs text-gray-500 font-normal"
                            >
                              (opcional)
                            </Typography>
                          </Typography>
                        </FormControl>
                        <Input
                          type="text"
                          fieldName={`choice_description_${index}`}
                          onChange={(e) =>
                            updateChoice(index, 'description', e.target.value)
                          }
                          placeholder="Descrição adicional (opcional)"
                        />
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="gradient"
                  onClick={addChoice}
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Opção
                </Button>
              </div>
            )}
          </div>

          {/* Campos Opcionais baseados no tipo */}
          {(interactiveMenuType === 'button' ||
            interactiveMenuType === 'list') && (
            <div className="p-1">
              <FormControl variant="label">
                Texto do Rodapé (opcional)
              </FormControl>
              <Input
                type="text"
                fieldName="interactiveMenuFooter"
                placeholder="Texto exibido no rodapé..."
              />
            </div>
          )}

          {interactiveMenuType === 'list' && (
            <div className="p-1">
              <FormControl variant="label">
                Texto do Botão da Lista *
              </FormControl>
              <Input
                type="text"
                fieldName="interactiveMenuListButton"
                placeholder="Ex: Ver opções"
              />
            </div>
          )}

          {interactiveMenuType === 'button' && (
            <div className="p-1">
              <FormControl variant="label">
                URL da Imagem (opcional)
              </FormControl>
              <Input
                type="url"
                fieldName="interactiveMenuImageButton"
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
          )}

          {interactiveMenuType === 'poll' && (
            <div className="p-1">
              <FormControl variant="label">Opções Selecionáveis</FormControl>
              <Input
                type="number"
                fieldName="interactiveMenuSelectableCount"
                placeholder="1"
                min="1"
              />
              <Typography variant="span" className="text-xs text-gray-500 mt-1">
                Quantas opções o usuário pode selecionar
              </Typography>
            </div>
          )}

          {/* Opções Avançadas para Menu Interativo */}
          <div className="border-t pt-4 mt-4">
            <Typography variant="h5" className="font-semibold mb-3">
              ⚙️ Opções Avançadas
            </Typography>

            {/* Responder Mensagem */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  ID da mensagem para responder (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="replyId"
                placeholder="3EB0538DA65A59F6D8A251"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                ID da mensagem que será respondida
              </Typography>
            </div>

            {/* Menções */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Menções (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="mentions"
                placeholder="5511999999999,5511888888888"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Números para mencionar, separados por vírgula
              </Typography>
            </div>

            {/* Checkboxes de leitura */}
            <div className="space-y-2 p-3 bg-gray-50/40 rounded-lg">
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="readChat"
                  onChange={(e) => setValue('readChat', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl variant="label" className="text-sm cursor-pointer">
                  Marcar conversa como lida após envio
                </FormControl>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  fieldName="readMessages"
                  onChange={(e) => setValue('readMessages', e.target.checked)}
                  className="bg-neutral-200"
                />
                <FormControl variant="label" className="text-sm cursor-pointer">
                  Marcar últimas mensagens recebidas como lidas
                </FormControl>
              </div>
            </div>

            {/* Delay */}
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Atraso antes do envio (opcional)
                </Typography>
              </FormControl>
              <Input type="number" fieldName="delay" placeholder="1000" />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Tempo em milissegundos. Durante o atraso aparecerá
                &quot;Digitando...&quot;
              </Typography>
            </div>

            {/* Rastreamento */}
            <div className="space-y-3 p-3 bg-neutral-50 rounded-lg">
              <Typography variant="span" className="text-sm font-medium">
                Rastreamento
              </Typography>
              <div className="p-1">
                <FormControl variant="label">
                  <Typography variant="span" className="text-sm">
                    Origem (opcional)
                  </Typography>
                </FormControl>
                <Input
                  type="text"
                  fieldName="trackSource"
                  placeholder="chatwoot"
                />
              </div>
              <div className="p-1">
                <FormControl variant="label">
                  <Typography variant="span" className="text-sm">
                    ID de rastreamento (opcional)
                  </Typography>
                </FormControl>
                <Input
                  type="text"
                  fieldName="trackId"
                  placeholder="msg_123456789"
                />
                <Typography
                  variant="span"
                  className="text-xs text-neutral-600 mt-1"
                >
                  Aceita valores duplicados
                </Typography>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuração de Template (WhatsApp Cloud API) */}
      {messageType === 'template' && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex justify-between items-center">
            <Typography variant="h5" className="font-semibold">
              📄 Configuração de Template
            </Typography>
            <Button
              variant="gradient"
              onClick={() => setShowTemplateManager(true)}
              className="w-fit"
            >
              <Settings size={16} />
              Gerenciar Templates
            </Button>
          </div>

          {/* Select de Template */}
          <div className="p-1">
            <FormControl variant="label">Template *</FormControl>
            {loadingTemplates ? (
              <div className="text-sm text-gray-500 py-2">
                Carregando templates...
              </div>
            ) : (
              (() => {
                // Filtrar apenas templates aprovados para o select
                const approvedTemplates = templates.filter(
                  (t) => t.status === 'APPROVED',
                );
                return approvedTemplates.length === 0 ? (
                  <div className="text-sm text-amber-600 py-2">
                    Nenhum template aprovado encontrado. Crie templates no Meta
                    Business Manager.
                  </div>
                ) : (
                  <FormSelect
                    fieldName="templateName"
                    placeholder="Selecione um template"
                    options={approvedTemplates.map((template) => ({
                      value: template.name,
                      label: `${template.name} (${template.language})`,
                    }))}
                    className="w-full"
                    onValueChange={(value) => {
                      // Garantir que messageType seja 'template' quando um template é selecionado
                      if (value && value.trim() !== '') {
                        setValue('messageType', 'template');
                        const template = templates.find(
                          (t) => t.name === value,
                        );
                        if (template) {
                          setSelectedTemplate(template);
                          setValue('templateLanguage', template.language);
                        }
                      } else {
                        setSelectedTemplate(null);
                      }
                    }}
                  />
                );
              })()
            )}
          </div>

          {/* Mostrar variáveis do template selecionado */}
          {selectedTemplate && selectedTemplate.components && (
            <div className="space-y-3 border p-3 rounded bg-gray-50">
              <Typography variant="h6" className="font-semibold text-sm">
                Variáveis do Template
              </Typography>

              {selectedTemplate.components.map(
                (component, compIndex: number) => {
                  // Para BODY, extrair variáveis
                  if (component.type === 'BODY' && component.text) {
                    const matches = component.text.match(/\{\{(\d+)\}\}/g);
                    if (matches && matches.length > 0) {
                      return matches.map((match: string, index: number) => {
                        const varNumber = match.replace(/[{}]/g, '');
                        const key = `body_${varNumber}`;
                        return (
                          <div key={`${compIndex}-${index}`} className="p-1">
                            <FormControl variant="label">
                              Variável {varNumber}{' '}
                              {component.example?.body_text?.[0]?.[index] && (
                                <span className="text-xs text-gray-500">
                                  (ex: {component.example.body_text[0][index]})
                                </span>
                              )}
                            </FormControl>
                            <Input
                              type="text"
                              fieldName={`template_var_${key}`}
                              placeholder={
                                component.example?.body_text?.[0]?.[index] ||
                                `Valor para {{${varNumber}}}`
                              }
                              value={templateVariables[key] || ''}
                              onChange={(e) => {
                                const newVars = {
                                  ...templateVariables,
                                  [key]: e.target.value,
                                };
                                setTemplateVariables(newVars);
                                setValue(
                                  'templateVariables',
                                  JSON.stringify(newVars),
                                );
                              }}
                            />
                          </div>
                        );
                      });
                    }
                  }
                  return null;
                },
              )}

              {/* Preview do template */}
              <div className="mt-3 p-3 bg-white border rounded">
                <Typography
                  variant="span"
                  className="text-xs text-gray-600 mb-2 block"
                >
                  Preview:
                </Typography>
                <div className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {selectedTemplate.components
                    .map((comp) => {
                      if (comp.type === 'BODY' && comp.text) {
                        let preview = comp.text;
                        // Substituir variáveis se existirem
                        Object.entries(templateVariables).forEach(
                          ([key, value]) => {
                            if (key.startsWith('body_')) {
                              const varNum = key.replace('body_', '');
                              preview = preview.replace(
                                `{{${varNum}}}`,
                                value || `{{${varNum}}}`,
                              );
                            }
                          },
                        );
                        return preview;
                      }
                      if (comp.type === 'HEADER' && comp.text) {
                        return comp.text;
                      }
                      return null;
                    })
                    .filter(Boolean)
                    .join('\n\n') || 'Nenhum conteúdo disponível'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Opções Avançadas para Mídia */}
      {messageType === 'media' && (
        <div className="border-t pt-4 mt-4">
          <Typography variant="h5" className="font-semibold mb-3">
            ⚙️ Opções Avançadas
          </Typography>

          {/* Responder Mensagem */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                ID da mensagem para responder (opcional)
              </Typography>
            </FormControl>
            <Input
              type="text"
              fieldName="replyId"
              placeholder="3EB0538DA65A59F6D8A251"
            />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              ID da mensagem que será respondida
            </Typography>
          </div>

          {/* Menções */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                Menções (opcional)
              </Typography>
            </FormControl>
            <Input
              type="text"
              fieldName="mentions"
              placeholder="5511999999999,5511888888888"
            />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              Números para mencionar, separados por vírgula
            </Typography>
          </div>

          {/* Checkboxes de leitura */}
          <div className="space-y-2 p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Input
                type="checkbox"
                fieldName="readChat"
                onChange={(e) => setValue('readChat', e.target.checked)}
                className="bg-neutral-200"
              />
              <FormControl variant="label" className="text-sm cursor-pointer">
                Marcar conversa como lida após envio
              </FormControl>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="checkbox"
                fieldName="readMessages"
                onChange={(e) => setValue('readMessages', e.target.checked)}
                className="bg-neutral-200"
              />
              <FormControl variant="label" className="text-sm cursor-pointer">
                Marcar últimas mensagens recebidas como lidas
              </FormControl>
            </div>
          </div>

          {/* Delay */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                Atraso antes do envio (opcional)
              </Typography>
            </FormControl>
            <Input type="number" fieldName="delay" placeholder="1000" />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              Tempo em milissegundos. Durante o atraso aparecerá
              &quot;Digitando...&quot;
            </Typography>
          </div>

          {/* Rastreamento */}
          <div className="space-y-3 p-3 bg-neutral-50 rounded-lg">
            <Typography variant="span" className="text-sm font-medium">
              Rastreamento
            </Typography>
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Origem (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="trackSource"
                placeholder="chatwoot"
              />
            </div>
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  ID de rastreamento (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="trackId"
                placeholder="msg_123456789"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Aceita valores duplicados
              </Typography>
            </div>
          </div>
        </div>
      )}

      {/* Opções Avançadas para Contato e Localização */}
      {(messageType === 'contact' || messageType === 'location') && (
        <div className="border-t pt-4 mt-4">
          <Typography variant="h5" className="font-semibold mb-3">
            ⚙️ Opções Avançadas
          </Typography>

          {/* Responder Mensagem */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                ID da mensagem para responder (opcional)
              </Typography>
            </FormControl>
            <Input
              type="text"
              fieldName="replyId"
              placeholder="3EB0538DA65A59F6D8A251"
            />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              ID da mensagem que será respondida
            </Typography>
          </div>

          {/* Menções */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                Menções (opcional)
              </Typography>
            </FormControl>
            <Input
              type="text"
              fieldName="mentions"
              placeholder="5511999999999,5511888888888"
            />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              Números para mencionar, separados por vírgula
            </Typography>
          </div>

          {/* Checkboxes de leitura */}
          <div className="space-y-2 p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Input
                type="checkbox"
                fieldName="readChat"
                onChange={(e) => setValue('readChat', e.target.checked)}
                className="bg-neutral-200"
              />
              <FormControl variant="label" className="text-sm cursor-pointer">
                Marcar conversa como lida após envio
              </FormControl>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="checkbox"
                fieldName="readMessages"
                onChange={(e) => setValue('readMessages', e.target.checked)}
                className="bg-neutral-200"
              />
              <FormControl variant="label" className="text-sm cursor-pointer">
                Marcar últimas mensagens recebidas como lidas
              </FormControl>
            </div>
          </div>

          {/* Delay */}
          <div className="p-1">
            <FormControl variant="label">
              <Typography variant="span" className="text-sm">
                Atraso antes do envio (opcional)
              </Typography>
            </FormControl>
            <Input type="number" fieldName="delay" placeholder="1000" />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              Tempo em milissegundos. Durante o atraso aparecerá
              &quot;Digitando...&quot;
            </Typography>
          </div>

          {/* Rastreamento */}
          <div className="space-y-3 p-3 bg-neutral-50 rounded-lg">
            <Typography variant="span" className="text-sm font-medium">
              Rastreamento
            </Typography>
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  Origem (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="trackSource"
                placeholder="chatwoot"
              />
            </div>
            <div className="p-1">
              <FormControl variant="label">
                <Typography variant="span" className="text-sm">
                  ID de rastreamento (opcional)
                </Typography>
              </FormControl>
              <Input
                type="text"
                fieldName="trackId"
                placeholder="msg_123456789"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Aceita valores duplicados
              </Typography>
            </div>
          </div>
        </div>
      )}

      {/* Seção de Configuração de Memória */}
      <MemoryConfigSection
        memoryItems={memoryItems}
        setMemoryItems={setMemoryItems}
        form={form}
        setValue={setValue}
      />

      <SubmitButton
        variant="gradient"
        className="absolute top-2 right-12 w-fit mt-4"
      >
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function MessageNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: MessageNodeConfigProps) {
  // Buscar instâncias sob demanda apenas quando este componente for montado
  const { data: instances = [] } = useInstances({
    enabled: true,
  });

  // Estados para configuração de memória
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  // Estado para armazenar o modo de configuração (precisamos dele aqui para o submit)
  const [currentConfigMode, setCurrentConfigMode] = useState<'manual' | 'json'>(
    'manual',
  );
  const [currentJsonConfig, setCurrentJsonConfig] = useState<string>('');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [selectedInstanceToken, setSelectedInstanceToken] =
    useState<string>('');

  // 🔧 Estados para armazenar choices, categorias e cartões (necessários para o submit)
  interface Choice {
    id: string;
    text: string;
    description: string;
    actionType?: 'copy' | 'link' | 'call' | 'return_id';
  }

  interface ListCategory {
    id: string;
    name: string;
    items: Choice[];
  }

  interface CarouselCard {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    buttons: Choice[];
  }

  const [currentChoices, setCurrentChoices] = useState<Choice[]>([
    { id: '', text: '', description: '', actionType: undefined },
  ]);

  const [currentListCategories, setCurrentListCategories] = useState<
    ListCategory[]
  >([
    {
      id: crypto.randomUUID(),
      name: '',
      items: [{ id: '', text: '', description: '', actionType: undefined }],
    },
  ]);

  const [currentCarouselCards, setCurrentCarouselCards] = useState<
    CarouselCard[]
  >([
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      imageUrl: '',
      buttons: [{ id: '', text: '', description: '', actionType: undefined }],
    },
  ]);

  // Carregar configuração de memória quando config mudar
  useEffect(() => {
    if (config?.memoryConfig?.items && config.memoryConfig.items.length > 0) {
      setMemoryItems(config.memoryConfig.items);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    // Debug: verificar o que está sendo recebido
    console.log('📝 handleSubmit recebeu:', {
      messageType: data.messageType,
      templateName: data.templateName,
      templateLanguage: data.templateLanguage,
      text: data.text,
      token: data.token,
      phoneNumber: data.phoneNumber,
    });

    // 🔧 CORREÇÃO: Garantir que messageType esteja definido
    // Se um template foi selecionado, garantir que messageType seja 'template'
    if (data.templateName && data.templateName.trim() !== '') {
      data.messageType = 'template';
    }

    // Se messageType não estiver definido E não houver templateName, usar 'text' como padrão
    // IMPORTANTE: Não sobrescrever se já for 'template'
    if (
      (!data.messageType || data.messageType === '') &&
      (!data.templateName || data.templateName.trim() === '')
    ) {
      data.messageType = 'text';
    }

    // Garantir que se messageType for 'template', ele seja mantido
    if (data.messageType === 'template') {
      // Garantir que templateName e templateLanguage estejam presentes
      if (!data.templateName || data.templateName.trim() === '') {
        console.warn(
          '⚠️ messageType é template mas templateName não está definido',
        );
      }
    }

    // 🔧 CORREÇÃO: Sincronizar manualmente os estados locais com o campo do formulário
    // antes de processar o submit, garantindo que os dados estejam atualizados
    if (
      data.messageType === 'interactive_menu' &&
      currentConfigMode === 'manual'
    ) {
      if (data.interactiveMenuType === 'list') {
        // Sincronizar listCategories
        const choicesStrings: string[] = [];
        currentListCategories.forEach((category) => {
          if (category.name && category.name.trim() !== '') {
            choicesStrings.push(`[${category.name}]`);
          }
          category.items.forEach((item) => {
            if (item.text && item.text.trim() !== '') {
              choicesStrings.push(
                `${item.text}|${item.id || ''}|${item.description || ''}`,
              );
            }
          });
        });
        data.interactiveMenuChoices = JSON.stringify(choicesStrings);
      } else if (data.interactiveMenuType === 'carousel') {
        // Sincronizar carouselCards
        const choicesStrings: string[] = [];
        currentCarouselCards.forEach((card) => {
          if (card.title && card.title.trim() !== '') {
            const titleLine = card.description
              ? `[${card.title}\n${card.description}]`
              : `[${card.title}]`;
            choicesStrings.push(titleLine);
          }
          if (card.imageUrl && card.imageUrl.trim() !== '') {
            choicesStrings.push(`{${card.imageUrl}}`);
          }
          card.buttons.forEach((button) => {
            if (button.text && button.text.trim() !== '') {
              let finalId = button.id || '';
              if (button.actionType === 'copy') {
                finalId = `copy:${button.id}`;
              } else if (button.actionType === 'call') {
                finalId = `call:${button.id}`;
              } else if (button.actionType === 'return_id') {
                finalId = `${button.id}`;
              }
              choicesStrings.push(`${button.text}|${finalId}`);
            }
          });
        });
        data.interactiveMenuChoices = JSON.stringify(choicesStrings);
      } else {
        // Sincronizar choices (button, poll)
        const choicesStrings = currentChoices
          .map((choice) => {
            if (!choice.text || choice.text.trim() === '') return '';
            let finalId = choice.id || '';
            if (choice.actionType === 'copy') {
              finalId = `copy:${choice.id}`;
            } else if (choice.actionType === 'call') {
              finalId = `call:${choice.id}`;
            } else if (choice.actionType === 'return_id') {
              finalId = `${choice.id}`;
            }
            return `${choice.text}|${finalId}|${choice.description || ''}`;
          })
          .filter((str) => str !== '');
        data.interactiveMenuChoices = JSON.stringify(choicesStrings);
      }
    }

    // Se estiver no modo JSON e for interactive_menu do tipo list, processar o JSON das categorias
    if (
      currentConfigMode === 'json' &&
      data.messageType === 'interactive_menu' &&
      data.interactiveMenuType === 'list'
    ) {
      // Se o JSON for apenas uma variável (ex: {{list_categories}}), salvar diretamente
      const trimmedJson = currentJsonConfig.trim();
      const isVariable = /^\{\{.+\}\}$/.test(trimmedJson);

      if (isVariable) {
        // Se for uma variável dinâmica, salvar como string para ser processada no worker
        data.interactiveMenuChoices = trimmedJson;
      } else {
        // Se for JSON literal, processar normalmente
        try {
          // Remover comentários do JSON antes de parsear
          const jsonWithoutComments = currentJsonConfig.replace(
            /\/\/.*$/gm,
            '',
          );
          const parsedCategories = JSON.parse(jsonWithoutComments);

          // Validar se é um array
          if (!Array.isArray(parsedCategories)) {
            alert(
              'O JSON deve ser um array de categorias. Exemplo:\\n[{ "category": "...", "items": [{ "text": "...", "id": "...", "description": "..." }] }]',
            );
            return;
          }

          // Converter as categorias parseadas para o formato do choices
          const choicesStrings: string[] = [];

          parsedCategories.forEach((cat) => {
            // Adicionar categoria se tiver nome
            if (cat.category && cat.category.trim() !== '') {
              choicesStrings.push(`[${cat.category}]`);
            }

            // Adicionar itens da categoria
            if (cat.items && Array.isArray(cat.items)) {
              cat.items.forEach(
                (item: { text: string; id: string; description?: string }) => {
                  if (item.text && item.text.trim() !== '') {
                    choicesStrings.push(
                      `${item.text}|${item.id || ''}|${item.description || ''}`,
                    );
                  }
                },
              );
            }
          });

          // Atualizar data com os choices convertidos
          data.interactiveMenuChoices = JSON.stringify(choicesStrings);
        } catch (error) {
          alert(
            'Erro ao parsear JSON das categorias. Verifique se o formato está correto.\\n\\n' +
              (error instanceof Error ? error.message : String(error)),
          );
          return;
        }
      }
    }
    // Se estiver no modo JSON e for interactive_menu do tipo carousel, processar o JSON dos cartões
    else if (
      currentConfigMode === 'json' &&
      data.messageType === 'interactive_menu' &&
      data.interactiveMenuType === 'carousel'
    ) {
      // Se o JSON for apenas uma variável (ex: {{carousel_produtos}}), salvar diretamente
      const trimmedJson = currentJsonConfig.trim();
      const isVariable = /^\{\{.+\}\}$/.test(trimmedJson);

      if (isVariable) {
        // Se for uma variável dinâmica, salvar como string para ser processada no worker
        data.interactiveMenuChoices = trimmedJson;
      } else {
        // Se for JSON literal, processar normalmente
        try {
          // Remover comentários do JSON antes de parsear
          const jsonWithoutComments = currentJsonConfig.replace(
            /\/\/.*$/gm,
            '',
          );
          const parsedCards = JSON.parse(jsonWithoutComments);

          // Validar se é um array
          if (!Array.isArray(parsedCards)) {
            alert(
              'O JSON deve ser um array de cartões. Exemplo:\\n[{ "title": "...", "description": "...", "imageUrl": "...", "buttons": [...] }]',
            );
            return;
          }

          // Converter os cartões parseados para o formato do choices
          const choicesStrings: string[] = [];

          parsedCards.forEach((card) => {
            // Adicionar título e descrição do cartão (formato: [Título\nDescrição])
            if (card.title && card.title.trim() !== '') {
              const titleLine = card.description
                ? `[${card.title}\n${card.description}]`
                : `[${card.title}]`;
              choicesStrings.push(titleLine);
            }

            // Adicionar URL da imagem (formato: {URL})
            if (card.imageUrl && card.imageUrl.trim() !== '') {
              choicesStrings.push(`{${card.imageUrl}}`);
            }

            // Adicionar botões do cartão
            if (card.buttons && Array.isArray(card.buttons)) {
              card.buttons.forEach(
                (button: { text: string; id: string; actionType?: string }) => {
                  if (button.text && button.text.trim() !== '') {
                    // Montar ID com prefixo baseado no actionType
                    let finalId = button.id || '';
                    if (button.actionType === 'copy') {
                      finalId = `copy:${button.id}`;
                    } else if (button.actionType === 'call') {
                      finalId = `call:${button.id}`;
                    } else if (button.actionType === 'return_id') {
                      finalId = `${button.id}`;
                    }
                    // Para 'link', não adiciona prefixo (já é a URL completa)

                    choicesStrings.push(`${button.text}|${finalId}`);
                  }
                },
              );
            }
          });

          // Atualizar data com os choices convertidos
          data.interactiveMenuChoices = JSON.stringify(choicesStrings);
        } catch (error) {
          alert(
            'Erro ao parsear JSON dos cartões. Verifique se o formato está correto.\\n\\n' +
              (error instanceof Error ? error.message : String(error)),
          );
          return;
        }
      }
    }

    // Modo manual (código original)
    // Garantir que messageType esteja definido
    // IMPORTANTE: Se templateName existe, messageType deve ser 'template'
    let finalMessageType: MessageType = (data.messageType ||
      'text') as MessageType;
    if (data.templateName && data.templateName.trim() !== '') {
      finalMessageType = 'template';
    }

    // Debug: verificar o que será salvo
    console.log('💾 Salvando messageConfig:', {
      messageType: finalMessageType,
      templateName: data.templateName,
      templateLanguage: data.templateLanguage,
    });

    const messageConfig: MessageConfig = {
      token: data.token,
      phoneNumber: data.phoneNumber,
      messageType: finalMessageType,
      text: finalMessageType === 'text' ? data.text : undefined,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType as
        | 'image'
        | 'video'
        | 'document'
        | 'audio'
        | 'myaudio'
        | 'ptt'
        | 'sticker'
        | undefined,
      docName: data.docName,
      caption: data.caption,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactOrganization: data.contactOrganization,
      contactEmail: data.contactEmail,
      contactUrl: data.contactUrl,
      latitude: data.latitude ? parseFloat(data.latitude) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude) : undefined,
      // Opções avançadas
      linkPreview: data.linkPreview || undefined,
      linkPreviewTitle: data.linkPreviewTitle || undefined,
      linkPreviewDescription: data.linkPreviewDescription || undefined,
      linkPreviewImage: data.linkPreviewImage || undefined,
      linkPreviewLarge: data.linkPreviewLarge || undefined,
      replyId: data.replyId || undefined,
      mentions: data.mentions || undefined,
      readChat: data.readChat || undefined,
      readMessages: data.readMessages || undefined,
      delay: data.delay ? parseInt(data.delay) : undefined,
      forward: data.forward || undefined,
      trackSource: data.trackSource || undefined,
      trackId: data.trackId || undefined,
    };

    if (finalMessageType === 'template') {
      messageConfig.templateName = data.templateName || undefined;
      messageConfig.templateLanguage = data.templateLanguage || undefined;
      if (data.templateVariables && data.templateVariables.trim() !== '') {
        try {
          const parsed = JSON.parse(data.templateVariables);
          messageConfig.templateVariables = parsed;
        } catch (error) {
          console.error('Erro ao parsear templateVariables:', error);
          messageConfig.templateVariables = undefined;
        }
      } else {
        messageConfig.templateVariables = undefined;
      }
    } else {
      messageConfig.templateName = undefined;
      messageConfig.templateLanguage = undefined;
      messageConfig.templateVariables = undefined;
    }

    // Se for menu interativo, adicionar configuração
    if (finalMessageType === 'interactive_menu') {
      let choices: string[] = [];

      if (data.interactiveMenuChoices) {
        const choicesStr = data.interactiveMenuChoices;
        // Verificar se é uma variável dinâmica (ex: {{carousel_produtos}})
        const isVariable = /^\{\{.+\}\}$/.test(choicesStr.trim());

        if (isVariable) {
          // Se for variável, salvar como array com a variável
          choices = [choicesStr];
        } else {
          // Se for JSON, fazer parse
          try {
            choices = JSON.parse(choicesStr);
          } catch (error) {
            console.error('Error parsing choices:', error);
            choices = [];
          }
        }
      }

      messageConfig.interactiveMenu = {
        type: data.interactiveMenuType as InteractiveMenuType,
        text: data.interactiveMenuText,
        choices: choices.filter((c: string) => c.trim() !== ''),
        footerText: data.interactiveMenuFooter || undefined,
        listButton: data.interactiveMenuListButton || undefined,
        imageButton: data.interactiveMenuImageButton || undefined,
        selectableCount: data.interactiveMenuSelectableCount
          ? parseInt(data.interactiveMenuSelectableCount)
          : undefined,
      };
    }

    // Se configuração de memória estiver preenchida, adicionar ao messageConfig
    if (data.memoryName && data.memoryAction && data.memoryAction !== '') {
      // Processar TTL baseado no preset selecionado
      let ttl: number | undefined = undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      messageConfig.memoryConfig = {
        action: data.memoryAction as 'save' | 'fetch' | 'delete',
        memoryName: data.memoryName,
        items:
          data.memoryAction === 'save'
            ? (data.memoryItems as MemoryItem[])
            : undefined,
        ttl: ttl,
        defaultValue: data.memoryDefaultValue,
        saveMode:
          data.memoryAction === 'save'
            ? (data.memorySaveMode as 'overwrite' | 'append')
            : undefined,
      };
    }

    // Debug: verificar o que será passado para onSave
    console.log(
      '🚀 Passando para onSave:',
      JSON.stringify(messageConfig, null, 2),
    );

    onSave(messageConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Mensagem"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={messageConfigSchema}
        onSubmit={handleSubmit}
      >
        <MessageFormFields
          instances={instances}
          config={config}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
          configMode={currentConfigMode}
          setConfigMode={setCurrentConfigMode}
          jsonConfig={currentJsonConfig}
          setJsonConfig={setCurrentJsonConfig}
          choices={currentChoices}
          setChoices={setCurrentChoices}
          listCategories={currentListCategories}
          setListCategories={setCurrentListCategories}
          carouselCards={currentCarouselCards}
          setCarouselCards={setCurrentCarouselCards}
          setShowTemplateManager={setShowTemplateManager}
          setSelectedInstanceToken={setSelectedInstanceToken}
        />
      </Form>

      {/* Modal de Gerenciamento de Templates */}
      <TemplateManagerModal
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        instanceToken={selectedInstanceToken}
        onTemplateCreated={() => {
          // Fechar o modal e a lógica de reload já está no useEffect do MessageFormFields
          setShowTemplateManager(false);
        }}
      />
    </NodeConfigLayout>
  );
}
