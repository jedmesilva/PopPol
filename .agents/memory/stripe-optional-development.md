---
name: Stripe opcional no desenvolvimento
description: Comportamento esperado da API quando o workspace não possui uma conexão Stripe configurada.
---

A inicialização do Stripe é opcional para o ambiente de desenvolvimento: a API principal deve continuar subindo sem credenciais, enquanto checkout, webhook e sincronização permanecem indisponíveis até que o Stripe seja conectado.

**Why:** O produto principal (consulta de políticos, atividade e estatísticas) não depende de pagamentos, e uma conexão Stripe ausente não deve deixar todo o preview fora do ar.

**How to apply:** Preserve o tratamento explícito de erro no boot e deixe as rotas específicas de Stripe falharem de forma localizada quando a integração não estiver configurada.