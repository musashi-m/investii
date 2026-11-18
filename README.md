# Investidor10x — Carteira de Investimentos

Aplicação web de acompanhamento de carteira de investimentos (Renda Variável e Renda Fixa) com cotações reais, cálculo de IOF/IR regressivo, consolidação de patrimônio e proteção por PIN.

## Principais Recursos

- **Lançamentos reais (sem mock):** Renda Variável (`Ações`, `FIIs`, `ETFs`, `BDRs`, `Criptos`, `Stocks EUA`), Renda Fixa (`CDB`, `LCI`, `LCA`, `Tesouro Direto`, `CRI/CRA`, `Debêntures`) e Proventos (`Dividendo`, `JCP`, `Rendimento`, `Juros`).
- **Cotações e índices em tempo real:** Yahoo Finance (B3, EUA e histórico mensal), CoinGecko (Criptos em BRL), Banco Central SGS (Selic, CDI diário e IPCA) e suporte opcional a token `brapi.dev`.
- **Renda Fixa Líquida e Bruta:** cálculo por lote de aporte com tabela regressiva de IR (`22,5%` a `15%`), IOF regressivo (< 30 dias) e opções clicáveis de isenção de IOF (desde o 1º dia) e de IR.
- **Rebalanceamento:** notas `0–10`, metas percentuais por categoria, `% Ideal` e indicação `Comprar? (Sim / Não)`.
- **Segurança:** acesso protegido por PIN de 4 dígitos (cookie `HttpOnly` assinado + proteção contra força bruta).
- **Banco de dados:** pronto para **Netlify Database (PostgreSQL)** via `@netlify/database` com migração automática em `netlify/database/migrations/`, e fallback transparente em SQLite local para desenvolvimento standalone.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

### Testes

```bash
npm test
npm run build
```

## Deploy na Netlify

1. Conecte este repositório na Netlify (`Build command: npm run build`, `Publish directory: .next` — já configurados em `netlify.toml`).
2. A Netlify detecta automaticamente `@netlify/database` e aplica a migração em `netlify/database/migrations/`.
3. *(Opcional)* Defina nas variáveis de ambiente da Netlify:
   - `ACCESS_PIN`: PIN numérico de acesso (padrão: `6734`).
   - `AUTH_SECRET`: chave secreta para assinatura do cookie de sessão.
