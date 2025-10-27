// ============================================
// SETUP PARA TESTES DE MESSAGE NODE
// ============================================

// Re-export node factory from central location
export { createMessageNode } from '../../../helpers/nodes';

// Re-export test config constants
export {
  TEST_WHATSAPP_TOKEN,
  TEST_PHONE_NUMBER,
} from '../../workflow/test-config';
