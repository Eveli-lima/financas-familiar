// ============================================================================
// MÓDULO 9: ASSISTENTE INTELIGENTE DE FINANÇAS DOMÉSTICAS (IA EDUCATIVA)
// ============================================================================
// Por que este módulo existe?
// Traduz os números, saldos e faturas para uma linguagem simples e humana,
// como se fosse uma educadora financeira de bolso conversando com o casal.
// Fornece diagnóstico do mês, alertas proativos e dicas práticas acionáveis.

function generateFinancialAiInsights(summary, radar, period) {
  const insights = [];
  const pLabel = formatPeriodLabel(period);
  const nextPLabel = period === 'ALL' ? 'o próximo mês' : formatPeriodLabel(addMonthsToPeriod(period, 1));

  const bankEnding = summary.bankEndingBalanceCents;
  const cardTotal = summary.totalCardCents;
  const projected = summary.projectedBalanceCents;
  const income = summary.totalIncomeCents;
  const bankDebits = summary.totalBankDebitCents;
  const sharedExp = summary.sharedExpensesCents;
  const indEveli = summary.individualEveliCents;
  const indMarido = summary.individualMaridoCents;
  const lanches = summary.spentByCatCents['Lanches & Restaurantes'] || 0;
  const uber = summary.spentByCatCents['Uber & Transporte'] || 0;
  const mercado = summary.spentByCatCents['Mercado & Hortifruti'] || 0;

  // 1. Diagnóstico do Balanço e Saldo da Conta
  if (bankEnding < 0) {
    insights.push({
      type: 'danger',
      icon: '🚨',
      title: `Conta Conjunta no Vermelho (${formatCentsBRL(bankEnding)})`,
      message: `A conta bancária virou com saldo negativo de <strong>${formatCentsBRL(Math.abs(bankEnding))}</strong>. Cuidado com juros de cheque especial do banco!`,
      action: 'Dica da IA: Priorize cobrir esse saldo antes de realizar novos gastos no débito ou PIX.'
    });
  } else if (bankEnding < 10000 && bankEnding >= 0) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Saldo de Segurança Baixo na Conta',
      message: `O saldo em conta hoje está em <strong>${formatCentsBRL(bankEnding)}</strong>. Está bem perto de zero, o que deixa pouca margem para imprevistos imediatos.`,
      action: 'Dica da IA: Evitem novas saídas não essenciais no débito até entrar o próximo pagamento.'
    });
  } else if (bankEnding >= 50000) {
    insights.push({
      type: 'success',
      icon: '🌱',
      title: 'Folga Saudável na Conta Corrente',
      message: `Vocês têm <strong>${formatCentsBRL(bankEnding)}</strong> em conta. Um ótimo respiro financeiro!`,
      action: 'Dica da IA: Que tal direcionar parte dessa folga para uma das Metas do casal?'
    });
  }

  // 2. Análise de Fatura de Cartão vs. Renda
  if (cardTotal > 0) {
    if (income > 0 && cardTotal > income) {
      insights.push({
        type: 'danger',
        icon: '💳',
        title: `Faturas Superam as Entradas do Mês!`,
        message: `As compras no cartão somam <strong>${formatCentsBRL(cardTotal)}</strong>, enquanto as receitas registradas foram de <strong>${formatCentsBRL(income)}</strong>.`,
        action: 'Dica da IA: Esse é o maior gerador de endividamento familiar. Avaliem renegociar ou pausar novas compras no crédito.'
      });
    } else if (income > 0 && cardTotal > (income * 0.5)) {
      insights.push({
        type: 'warning',
        icon: '💳',
        title: 'Faturas Consumindo Mais de 50% da Renda',
        message: `As faturas dos 2 cartões representam mais da metade de tudo o que entrou no mês.`,
        action: 'Dica da IA: Especialistas recomendam manter o cartão abaixo de 30% a 40% das receitas do casal.'
      });
    }
  }

  // 3. Radar de Parcelas e Alívio Futuro
  if (radar && radar.endingNow && radar.endingNow.length > 0) {
    insights.push({
      type: 'success',
      icon: '🎉',
      title: `Alívio Financeiro Chegando: ${formatCentsBRL(radar.endingNowCents)}/mês!`,
      message: `Boas notícias! <strong>${radar.endingNow.length} compra(s) parcelada(s)</strong> acabam agora em ${pLabel}. A partir de ${nextPLabel}, esse valor não virá mais na fatura!`,
      action: 'Dica de Ouro: Não preencham essa folga com novas parcelas! Usem para poupar ou quitar outras dívidas.'
    });
  }

  // 4. "Gastos Invisíveis" / Gastos Formiga (Lanches, Uber, Cafés)
  const lanchesUberCents = lanches + uber;
  if (lanchesUberCents > 50000) {
    insights.push({
      type: 'warning',
      icon: '🍔',
      title: `Gastos Frequentes em Destaque: ${formatCentsBRL(lanchesUberCents)}`,
      message: `Lanches, delivery e transporte por app somaram <strong>${formatCentsBRL(lanchesUberCents)}</strong> em ${pLabel} (${summary.lanchesCount} pedidos de lanche e ${summary.uberCount} corridas).`,
      action: 'Dica da IA: Pequenas escolhas de cozinhar em casa no fim de semana podem economizar de R$ 200 a R$ 400 por mês!'
    });
  }

  // 5. Divisão do Casal (Harmonia Financeira)
  const totalDespesas = sharedExp + indEveli + indMarido;
  if (totalDespesas > 0) {
    const pctCasal = Math.round((sharedExp / totalDespesas) * 100);
    if (pctCasal < 40 && (indEveli > 0 || indMarido > 0)) {
      insights.push({
        type: 'info',
        icon: '⚖️',
        title: 'Muitos Gastos Marcados como Individuais',
        message: `Apenas <strong>${pctCasal}%</strong> dos gastos foram classificados como "Casal", e a maior parte como individual.`,
        action: 'Dica de Gestão: Verifiquem se algumas dessas compras não foram na verdade para a casa ou alimentação de ambos.'
      });
    }
  }

  // 6. Alerta de Metas e Reservas
  if (state.futureGoals && state.futureGoals.length > 0) {
    const goalsPerto = state.futureGoals.filter(g => {
      const rem = toCents(g.totalAmount) - toCents(g.savedAmount);
      return rem > 0 && (toCents(g.savedAmount) / toCents(g.totalAmount)) >= 0.75;
    });
    if (goalsPerto.length > 0) {
      insights.push({
        type: 'success',
        icon: '🎯',
        title: `Meta Perto da Conquista!`,
        message: `A meta <strong>"${escapeHtml(goalsPerto[0].name)}"</strong> já passou de 75% guardado! Falta muito pouco para realizar!`,
        action: 'Continuem firmes no plano!'
      });
    }
  }

  // Se não houver alertas graves, dá uma mensagem de incentivo
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      icon: '✨',
      title: 'Finanças Estáveis no Período',
      message: `Tudo parece sob controle em ${pLabel}. As contas estão equilibradas e sem sinais de alerta grave.`,
      action: 'Dica da IA: Mantenham o hábito de registrar as compras logo após realizá-las.'
    });
  }

  return insights;
}

// Responde a dúvidas frequentes do usuário em linguagem bem leiga
const FINANCIAL_COACH_FAQ = [
  {
    q: 'O que significa o "Saldo Anterior" da Conta?',
    a: '<strong>É o dinheiro que veio do mês passado:</strong><br>O saldo que sobra na Conta Conjunta Itaú no último dia do mês passa automaticamente para o 1º dia do mês seguinte. Se sobrou dinheiro (ex: R$ 48,17 em Setembro), Outubro já começa com essa folga positiva; se ficou no vermelho, o mês seguinte começa devendo ao banco.'
  },
  {
    q: 'Como saber se sobrou dinheiro de verdade no mês?',
    a: '<strong>Olhe para o card da Conta Conjunta Itaú:</strong><br>Se o saldo estiver verde, aquele dinheiro está disponível na conta agora. Se você ainda tem fatura de cartão aberta no mês, lembre-se de reservar o valor dela para o dia do vencimento!'
  },
  {
    q: 'O que é "Competência" vs. "Caixa"?',
    a: '<strong>Simples assim:</strong><br>• <strong>Competência (Quando você comprou):</strong> O dia em que você passou o cartão no mercado (ex: dia 10). É quando o gasto realmente aconteceu na sua vida.<br>• <strong>Caixa (Quando o dinheiro sai da conta):</strong> O dia em que a fatura do cartão é paga com o dinheiro do banco (ex: dia 21).<br><br>Nosso sistema cuida dos dois automaticamente para você não ficar confusa!'
  },
  {
    q: 'Pagar a fatura do cartão duplica meus gastos?',
    a: '<strong>Não!</strong> Nós programamos o sistema para ser inteligente: quando você registra o pagamento da fatura, o dinheiro <em>sai da Conta Conjunta Itaú</em>, mas <em>não conta de novo</em> nas categorias de mercado, farmácia ou lanches, porque essas compras já foram somadas no mês do cartão.'
  },
  {
    q: 'Como guardar dinheiro sem passar aperto?',
    a: 'A regra de ouro da economia doméstica é: <strong>"Pague-se primeiro!"</strong>. Ao invés de esperar sobrar dinheiro no final do mês (o que quase nunca acontece), guarde uma pequena quantia (ex: R$ 50 ou R$ 100) assim que o salário cair na conta, usando a nossa aba <strong>Orçamentos & Metas</strong>.'
  },
  {
    q: 'Como organizar os gastos entre o casal (Éveli & Vital)?',
    a: 'Em finanças para casais, o mais saudável é transparência total (que vocês já têm aqui!), combinada com um pequeno espaço de liberdade individual. Contas da casa, mercado e saúde são <strong>Casal (Compartilhada)</strong>. Desejos puramente pessoais podem ser marcados como <strong>Individual</strong>.'
  }
];
