import { Typography } from '@/components/ui/typography';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <Typography variant="h1" className="text-3xl font-bold mb-6">
          Política de Privacidade
        </Typography>

        <div className="space-y-6 text-gray-700">
          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </Typography>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              1. Informações que Coletamos
            </Typography>
            <Typography variant="p" className="mb-2">
              Coletamos informações que você nos fornece diretamente, incluindo:
            </Typography>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Informações de conta (nome, email, telefone)</li>
              <li>Informações de perfil e configurações</li>
              <li>Dados de uso da plataforma</li>
              <li>Informações de integração com WhatsApp</li>
            </ul>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              2. Como Usamos suas Informações
            </Typography>
            <Typography variant="p" className="mb-2">
              Utilizamos as informações coletadas para:
            </Typography>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Fornecer, manter e melhorar nossos serviços</li>
              <li>Processar transações e enviar notificações relacionadas</li>
              <li>Gerenciar sua conta e preferências</li>
              <li>Enviar comunicações técnicas e de suporte</li>
              <li>Detectar e prevenir fraudes e abusos</li>
            </ul>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              3. Compartilhamento de Informações
            </Typography>
            <Typography variant="p" className="mb-2">
              Não vendemos suas informações pessoais. Podemos compartilhar suas
              informações apenas:
            </Typography>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                Com provedores de serviços que nos ajudam a operar nossa
                plataforma
              </li>
              <li>
                Com serviços de terceiros integrados (WhatsApp, Facebook/Meta)
                conforme necessário para fornecer os serviços
              </li>
              <li>Quando necessário para cumprir obrigações legais</li>
              <li>Com seu consentimento explícito</li>
            </ul>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              4. Integração com WhatsApp
            </Typography>
            <Typography variant="p" className="mb-2">
              Ao usar nossa integração com WhatsApp através da API oficial do
              Meta/Facebook:
            </Typography>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                Suas informações de conta WhatsApp são compartilhadas com
                Meta/Facebook conforme necessário para fornecer os serviços
              </li>
              <li>
                Respeitamos as políticas de privacidade do WhatsApp e Meta
              </li>
              <li>
                Você pode gerenciar as permissões através das configurações do
                Facebook App
              </li>
            </ul>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              5. Segurança dos Dados
            </Typography>
            <Typography variant="p" className="mb-2">
              Implementamos medidas de segurança técnicas e organizacionais para
              proteger suas informações pessoais contra acesso não autorizado,
              alteração, divulgação ou destruição.
            </Typography>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              6. Seus Direitos
            </Typography>
            <Typography variant="p" className="mb-2">
              Você tem o direito de:
            </Typography>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Acessar e corrigir suas informações pessoais</li>
              <li>Solicitar a exclusão de suas informações</li>
              <li>Retirar seu consentimento a qualquer momento</li>
              <li>Obter uma cópia dos seus dados pessoais</li>
            </ul>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              7. Retenção de Dados
            </Typography>
            <Typography variant="p" className="mb-2">
              Mantemos suas informações pessoais pelo tempo necessário para
              fornecer nossos serviços e cumprir nossas obrigações legais.
            </Typography>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              8. Alterações nesta Política
            </Typography>
            <Typography variant="p" className="mb-2">
              Podemos atualizar esta Política de Privacidade periodicamente.
              Notificaremos você sobre mudanças significativas publicando a nova
              política nesta página e atualizando a data de &quot;Última
              atualização&quot;.
            </Typography>
          </section>

          <section>
            <Typography variant="h2" className="text-xl font-semibold mb-3">
              9. Contato
            </Typography>
            <Typography variant="p" className="mb-2">
              Se você tiver dúvidas sobre esta Política de Privacidade, entre em
              contato conosco através do suporte da plataforma.
            </Typography>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Typography variant="p" className="text-sm text-gray-500">
            Esta política está em conformidade com a Lei Geral de Proteção de
            Dados (LGPD) e outras regulamentações aplicáveis.
          </Typography>
        </div>
      </div>
    </main>
  );
}
