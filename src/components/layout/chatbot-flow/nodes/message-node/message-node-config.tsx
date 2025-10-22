'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageConfig,
  MessageType,
  InteractiveMenuType,
  MemoryItem,
} from '../../types';
import { Typography } from '@/components/ui/typography';
import { useUser } from '@/hooks/use-user';
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
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { MemoryConfigSection } from '../memory-config-section';

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
  { value: 'text', label: 'Texto' },
  { value: 'media', label: 'Mídia' },
  { value: 'contact', label: 'Contato' },
  { value: 'location', label: 'Localização' },
  { value: 'interactive_menu', label: 'Menu Interativo' },
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

function MessageFormFields({
  instances,
  config,
  memoryItems,
  setMemoryItems,
  configMode,
  setConfigMode,
  jsonConfig,
  setJsonConfig,
}: {
  instances: InstanceProps[];
  config?: MessageConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  configMode: 'manual' | 'json';
  setConfigMode: React.Dispatch<React.SetStateAction<'manual' | 'json'>>;
  jsonConfig: string;
  setJsonConfig: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { form, setValue, errors } = useForm();
  const messageType = (form.messageType as MessageType) || 'text';
  const interactiveMenuType =
    (form.interactiveMenuType as InteractiveMenuType) || 'button';

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

  const [choices, setChoices] = useState<Choice[]>([
    { id: '', text: '', description: '', actionType: undefined },
  ]);

  const [listCategories, setListCategories] = useState<ListCategory[]>([
    {
      id: crypto.randomUUID(),
      name: '',
      items: [{ id: '', text: '', description: '', actionType: undefined }],
    },
  ]);

  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      imageUrl: '',
      buttons: [{ id: '', text: '', description: '', actionType: undefined }],
    },
  ]);

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

  // Sincronizar JSON quando o modo mudar para JSON ou quando carouselCards mudar
  useEffect(() => {
    if (configMode === 'json' && carouselCards.length > 0) {
      setJsonConfig(JSON.stringify(carouselCards, null, 2));
    }
  }, [configMode, carouselCards, setJsonConfig]);

  // Atualizar campo do formulário quando JSON mudar (para passar validação Zod)
  useEffect(() => {
    if (
      configMode === 'json' &&
      interactiveMenuType === 'carousel' &&
      jsonConfig.trim() !== ''
    ) {
      // Setar um valor dummy para passar a validação
      // O handleSubmit vai processar o JSON corretamente
      setValue('interactiveMenuChoices', '__JSON_MODE__');
    }
  }, [configMode, interactiveMenuType, jsonConfig, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('token', config.token || '');
        setValue('phoneNumber', config.phoneNumber || '');
        setValue('messageType', config.messageType || 'text');
        setValue('text', config.text || '');
        setValue('mediaUrl', config.mediaUrl || '');
        setValue('caption', config.caption || '');
        setValue('contactName', config.contactName || '');
        setValue('contactPhone', config.contactPhone || '');
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
          } else if (config.interactiveMenu.type === 'carousel') {
            // Parsear carousel cards
            const rawChoices = config.interactiveMenu.choices || [];
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
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  // Sincronizar actionType dos FormSelects com o estado choices/carouselCards
  useEffect(() => {
    if (interactiveMenuType === 'button') {
      choices.forEach((choice, index) => {
        if (choice.actionType) {
          setValue(`choice_actionType_${index}`, choice.actionType);
        }
      });
    } else if (interactiveMenuType === 'carousel') {
      carouselCards.forEach((card) => {
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
  }, [choices, carouselCards, interactiveMenuType, setValue]);

  // Atualizar choices no formulário quando mudar (converter para strings com pipe)
  useEffect(() => {
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
  }, [choices, listCategories, carouselCards, interactiveMenuType, setValue]);

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
          options={messageTypes}
          className="w-full"
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
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
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
            <FormControl variant="label">URL da Mídia</FormControl>
            <Input
              type="url"
              fieldName="mediaUrl"
              placeholder="https://exemplo.com/imagem.jpg"
            />
          </div>
          <div className="p-1">
            <FormControl variant="label">Legenda (opcional)</FormControl>
            <Textarea
              fieldName="caption"
              placeholder="Legenda da mídia..."
              rows={3}
            />
          </div>
        </div>
      )}

      {messageType === 'contact' && (
        <div className="space-y-3">
          <div>
            <FormControl variant="label">Nome do Contato</FormControl>
            <Input
              type="text"
              fieldName="contactName"
              placeholder="João Silva"
            />
          </div>
          <div>
            <FormControl variant="label">Telefone do Contato</FormControl>
            <Input
              type="tel"
              fieldName="contactPhone"
              placeholder="5511999999999"
            />
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
                            onClick={() => toggleCategoryExpansion(category.id)}
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
                              <Typography variant="span" className="text-sm">
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
                              value={category.name}
                              onChange={(e) =>
                                updateCategoryName(category.id, e.target.value)
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
                                    value={item.text}
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
                                    value={item.id}
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
                                    value={item.description}
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
                        className="w-fit px-4 py-2 text-sm"
                      >
                        📝 Manual
                      </Button>
                      <Button
                        type="button"
                        variant={configMode === 'json' ? 'gradient' : 'ghost'}
                        onClick={() => setConfigMode('json')}
                        className="w-fit px-4 py-2 text-sm"
                      >
                        {} JSON
                      </Button>
                    </div>
                  </div>
                </div>

                {configMode === 'json' ? (
                  // Modo JSON para Carrossel
                  <div>
                    <div className="flex items-center justify-between">
                      <FormControl variant="label">
                        Configuração JSON dos Cartões
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setJsonConfig(JSON_CAROUSEL_TEMPLATE)}
                        className="w-fit text-sm text-blue-600 hover:text-blue-700"
                      >
                        📄 Carregar Modelo de Exemplo
                      </Button>
                    </div>
                    <textarea
                      value={jsonConfig}
                      onChange={(e) => setJsonConfig(e.target.value)}
                      placeholder="Cole ou edite o JSON de configuração aqui..."
                      rows={15}
                      className="w-full rounded-md border border-gray-300 bg-white p-3 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] font-mono text-sm"
                    />
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Typography
                        variant="span"
                        className="text-xs text-blue-800"
                      >
                        <strong>💡 Dica:</strong> Você pode usar:
                        <br />• <strong>Variável dinâmica:</strong>{' '}
                        <code className="text-xs">{`{{carousel_produtos}}`}</code>{' '}
                        (resultado de transformation node)
                        <br />• <strong>JSON literal:</strong>{' '}
                        <code className="text-xs">{`[{ "title": "...", "imageUrl": "...", "buttons": [...] }]`}</code>
                        <br />• <strong>Comentários:</strong> Use // no JSON
                        para documentar (serão removidos ao salvar)
                      </Typography>
                    </div>
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
                                value={card.title}
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
                                value={card.description}
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
                                value={card.imageUrl}
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
                                  value={button.text}
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
                                  value={button.id}
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
                        value={choice.text}
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
                            value={choice.id}
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
                          value={choice.description}
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
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
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
        onClick={() => console.log(errors)}
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
  const { instances } = useUser();

  // Estados para configuração de memória
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  // Estado para armazenar o modo de configuração (precisamos dele aqui para o submit)
  const [currentConfigMode, setCurrentConfigMode] = useState<'manual' | 'json'>(
    'manual',
  );
  const [currentJsonConfig, setCurrentJsonConfig] = useState<string>('');

  // Carregar configuração de memória quando config mudar
  useEffect(() => {
    if (config?.memoryConfig?.items && config.memoryConfig.items.length > 0) {
      setMemoryItems(config.memoryConfig.items);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    // Se estiver no modo JSON e for interactive_menu do tipo carousel, processar o JSON dos cartões
    if (
      currentConfigMode === 'json' &&
      data.messageType === 'interactive_menu' &&
      data.interactiveMenuType === 'carousel'
    ) {
      // Se o JSON for apenas uma variável (ex: {{carousel_produtos}}), salvar diretamente
      const trimmedJson = currentJsonConfig.trim();
      const isVariable = /^\{\{[^}]+\}\}$/.test(trimmedJson);

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
    const messageConfig: MessageConfig = {
      token: data.token,
      phoneNumber: data.phoneNumber,
      messageType: data.messageType as MessageType,
      text: data.text,
      mediaUrl: data.mediaUrl,
      caption: data.caption,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
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

    // Se for menu interativo, adicionar configuração
    if (data.messageType === 'interactive_menu') {
      let choices: string[] = [];

      if (data.interactiveMenuChoices) {
        const choicesStr = data.interactiveMenuChoices;
        // Verificar se é uma variável dinâmica (ex: {{carousel_produtos}})
        const isVariable = /^\{\{[^}]+\}\}$/.test(choicesStr.trim());

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
        />
      </Form>
    </NodeConfigLayout>
  );
}
