# Investidor10x — Carteira de Investimentos

Aplicação web e **PWA (Progressive Web App)** de acompanhamento de carteira de investimentos (Renda Variável e Renda Fixa) com cotações reais, cálculo de IOF/IR regressivo, consolidação de patrimônio, simuladores avançados e proteção por PIN.

## Principais Recursos

- **PWA Instalável no Android & iOS:** suporte completo a Progressive Web App com Service Worker, cache inteligente offline, manifest com ícones adaptativos (maskable) e modo standalone (sem barra de URL do navegador).
- **Calculadora & Simulador de Renda Fixa:**
  - Simulação de saldo inicial, aportes mensais, prazo (meses/anos) e tipo de rentabilidade (CDI, Selic, IPCA+ ou Prefixado).
  - Cálculo de **Saldo Total Líquido**, **Saldo Investido (Principal)**, **Saldo em Juros Bruto** e **Dedução de IR** calculada de acordo com a cronologia individual de cada aporte mensal (alíquotas de 22,5% a 15%).
  - Comparativo automático com Caderneta de Poupança e CDB 100% CDI.
  - Gráfico de evolução mês a mês e tabela expansível lote a lote.
- **Calculadora do Número Mágico (Efeito Bola de Neve):**
  - Integração direta com os FIIs e Ações já cadastrados na carteira do usuário (mostra quantas cotas faltam para o dividendo mensal comprar 1 nova cota sozinho).
  - Simulador aberto para qualquer ativo da B3 com busca em tempo real.
  - Tabela de multiplicadores (1, 2, 5, 10 e 20 cotas/mês) e tempo estimado com aportes mensais.
- **Notificação Push Diária de Rendimento de Renda Fixa (08:00):**
  - Alerta automático diário às 08:00 informando quanto a carteira de Renda Fixa rendeu nas últimas 24h úteis.
  - Botão de teste instantâneo e botão de sino na barra de navegação.
- **Lançamentos reais (sem mock):** Renda Variável (`Ações`, `FIIs`, `ETFs`, `BDRs`, `Criptos`, `Stocks EUA`), Renda Fixa (`CDB`, `LCI`, `LCA`, `Tesouro Direto`, `CRI/CRA`, `Debêntures`) e Proventos (`Dividendo`, `JCP`, `Rendimento`, `Juros`).
- **Cotações e índices em tempo real:** Yahoo Finance (B3, EUA e histórico mensal), CoinGecko (Criptos em BRL), Banco Central SGS (Selic, CDI diário e IPCA) e suporte opcional a token `brapi.dev`.
- **Renda Fixa Líquida e Bruta:** cálculo por lote de aporte com tabela regressiva de IR (`22,5%` a `15%`), IOF regressivo (< 30 dias) e opções clicáveis de isenção de IOF (desde o 1º dia) e de IR.
- **Segurança:** acesso protegido por PIN de 4 dígitos (padrão `6734` ou variável `ACCESS_PIN`, com cookie `HttpOnly` assinado e bloqueio contra força bruta).
- **Banco de dados dual:** pronto para **Netlify Database (PostgreSQL)** via `@netlify/database` com migração automática em `netlify/database/migrations/`, e fallback transparente em SQLite local para desenvolvimento standalone.

## Como Instalar no Android (PWA)

1. Abra o site no **Google Chrome** no seu celular Android.
2. Toque no aviso **"Instalar Investidor10x"** que surge na parte inferior da tela, ou toque nos **3 pontinhos (⋮)** do navegador e selecione **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
3. O ícone do app será criado na sua tela inicial e abrirá em tela cheia como um aplicativo nativo.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

### Testes & Build

```bash
npm test
npm run build
```

## Deploy na Netlify

1. Conecte este repositório na Netlify (`Build command: npm run build`, `Publish directory: .next` — já configurados em `netlify.toml`).
2. A Netlify detecta automaticamente `@netlify/database` e aplica a migração em `netlify/database/migrations/`.
3. Defina nas variáveis de ambiente da Netlify:
   - `ACCESS_PIN`: PIN numérico de acesso (padrão: `6734`).
   - `AUTH_SECRET`: chave secreta para assinatura do cookie de sessão.
