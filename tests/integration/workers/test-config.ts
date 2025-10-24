/**
 * Configurações e Credenciais para Testes de Integração
 *
 * IMPORTANTE: Preencha as constantes abaixo com suas credenciais reais
 * ou valores de teste antes de executar os testes.
 */

// ============================================
// CREDENCIAIS DE TESTE - PREENCHA AQUI
// ============================================

/**
 * Token da API do WhatsApp/UAZApi
 * Este token identifica a instância do WhatsApp que IRÁ ENVIAR as mensagens (o bot)
 * Obtenha em: https://uazapi.com ou seu provedor de WhatsApp API
 */
export const TEST_WHATSAPP_TOKEN = '9f54e356-c6e8-405e-8760-ccefafd693c6'; // ← Token do bot que ENVIA

/**
 * Número de telefone que IRÁ RECEBER as mensagens de teste
 * Este é o número de destino (seu WhatsApp pessoal ou de teste)
 * Formato: +55DDDNÚMERO (exemplo: +5519971302477)
 */
export const TEST_PHONE_NUMBER = '+5519971302477'; // ← Número que RECEBE as mensagens

// ============================================
// VALIDAÇÃO (Não modificar)
// ============================================

/**
 * Verifica se as credenciais foram configuradas
 */
export function validateTestCredentials(): {
  isValid: boolean;
  message: string;
} {
  if (!TEST_WHATSAPP_TOKEN) {
    return {
      isValid: false,
      message:
        '⚠️  Por favor, configure TEST_WHATSAPP_TOKEN em tests/integration/workers/test-config.ts',
    };
  }

  if (!TEST_PHONE_NUMBER) {
    return {
      isValid: false,
      message:
        '⚠️  Por favor, configure TEST_PHONE_NUMBER em tests/integration/workers/test-config.ts',
    };
  }

  return {
    isValid: true,
    message: '✅ Credenciais configuradas corretamente',
  };
}

// ============================================
// CONFIGURAÇÕES ADICIONAIS (Opcional)
// ============================================

/**
 * URL base da API UAZApi (se necessário)
 */
export const TEST_API_BASE_URL = 'https://wazzy.uazapi.com';

/**
 * Timeout para testes de integração (ms)
 */
export const TEST_TIMEOUT = 30000;

/**
 * Se true, pula testes que precisam de credenciais reais
 * Útil para CI/CD ou testes locais sem configuração
 */
export const SKIP_CREDENTIAL_TESTS =
  process.env.SKIP_CREDENTIAL_TESTS === 'true';
