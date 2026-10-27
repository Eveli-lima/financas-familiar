// ============================================================================
// MÓDULO 2: SEMENTE DE DADOS (REAIS CONCILIADOS E MODO FICTÍCIO)
// ============================================================================
// Por que este módulo existe?
// Separa os dados iniciais (a fatura conciliada de R$ 3.096,11 e os extratos
// de Ago/Set/Out da Conta Conjunta Itaú) da lógica do sistema.

const baseTransactions = [
  // =====================================================================
  // 1. CONTA CORRENTE ITAÚ — OUTUBRO 2026 (R$ 500 Entrada / R$ 552,66 Saída)
  // =====================================================================
  { id: 'cc_1', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-10', date: '01/10/2026', type: 'income', kind: 'income', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF VITAL M01/10', amount: 500.00 },
  { id: 'cc_2', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-10', date: '01/10/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'PIX TRANSF Tania C01/10', amount: 14.00 },
  { id: 'cc_3', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-10', date: '05/10/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Auto Escola & Detran', desc: 'PAG BOLETO DETRAN - ESTADO DO RIO DE JA', amount: 419.55 },
  { id: 'cc_4', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-10', date: '07/10/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'PIX TRANSF Amanda 07/10', amount: 110.00 },
  { id: 'cc_5', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-10', date: '13/10/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'SEGURO CARTAO 0000', amount: 9.11 },

  // =====================================================================
  // 2. FATURA DETALHADA CARTÃO ITAÚ MC GOLD (VENCIMENTO 21/10/2026 = R$ 3.096,11)
  // =====================================================================
  // 2A. PARCELAMENTOS DE MESES ANTERIORES (R$ 845,84)
  { id: 'fc_p1', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '27/11 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'ALURA 11/12 (Educação - Acaba em Nov)', installmentCurrent: 11, installmentTotal: 12, amount: 104.30 },
  { id: 'fc_p2', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '02/01 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'SuperBruno -C 10/10 (🎉 Última Parcela!)', installmentCurrent: 10, installmentTotal: 10, amount: 309.70 },
  { id: 'fc_p3', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '29/06 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'EBN *Canva0 04/12', installmentCurrent: 4, installmentTotal: 12, amount: 24.24 },
  { id: 'fc_p4', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'WS COSMETICO-C 04/05 (Acaba em Nov)', installmentCurrent: 4, installmentTotal: 5, amount: 24.02 },
  { id: 'fc_p5', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '14/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'OBJETIVAMARICA 03/03 (🎉 Última Parcela!)', installmentCurrent: 3, installmentTotal: 3, amount: 33.33 },
  { id: 'fc_p6', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '31/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'PERTHMARICABRA 03/04 (Acaba em Nov)', installmentCurrent: 3, installmentTotal: 4, amount: 29.75 },
  { id: 'fc_p7', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '31/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'BR DE MARICAMA 03/03 (🎉 Última Parcela!)', installmentCurrent: 3, installmentTotal: 3, amount: 35.52 },
  { id: 'fc_p8', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/08 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'CASAS PERNAMBU 03/03 (🎉 Última Parcela!)', installmentCurrent: 3, installmentTotal: 3, amount: 33.33 },
  { id: 'fc_p9', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '08/08 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'BellaCasaGUATA 03/12', installmentCurrent: 3, installmentTotal: 12, amount: 180.00 },
  { id: 'fc_p10', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '21/08 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'OBJETIVASAO GO 02/03 (Acaba em Nov)', installmentCurrent: 2, installmentTotal: 3, amount: 71.65 },

  // =====================================================================
  // 2B. FATURA DE SETEMBRO/2026 (CARTÃO MC GOLD 5544) — VENCIMENTO 21/09/2026
  // TOTAL EXATO DA FATURA: R$ 3.375,50 (CONFORME PDF OFICIAL ITAÚ)
  // =====================================================================
  // Parcelamentos ativos na fatura de Setembro/2026:
  { id: 'fc_sep_p1', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '27/11 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'ALURA 10/12', installmentCurrent: 10, installmentTotal: 12, amount: 104.30 },
  { id: 'fc_sep_p2', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '02/01 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'SuperBruno -C 09/10', installmentCurrent: 9, installmentTotal: 10, amount: 309.70 },
  { id: 'fc_sep_p3', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '13/04 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'ALICE SHOES -C 06/06', installmentCurrent: 6, installmentTotal: 6, amount: 33.35 },
  { id: 'fc_sep_p4', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '22/06 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'DROGARIA MDA-C 03/03', installmentCurrent: 3, installmentTotal: 3, amount: 58.66 },
  { id: 'fc_sep_p5', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '29/06 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'EBN *Canva0 03/12', installmentCurrent: 3, installmentTotal: 12, amount: 24.24 },
  { id: 'fc_sep_p6', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '07/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'WS COSMETICO-C 03/05', installmentCurrent: 3, installmentTotal: 5, amount: 24.02 },
  { id: 'fc_sep_p7', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '14/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'OBJETIVAMARICA 02/03', installmentCurrent: 2, installmentTotal: 3, amount: 33.33 },
  { id: 'fc_sep_p8', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/07 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'CP *AMIGAO 38 02/02', installmentCurrent: 2, installmentTotal: 2, amount: 30.97 },
  { id: 'fc_sep_p9', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '31/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'PERTHMARICABRA 02/04', installmentCurrent: 2, installmentTotal: 4, amount: 29.75 },
  { id: 'fc_sep_p10', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '31/07 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'BR DE MARICAMA 02/03', installmentCurrent: 2, installmentTotal: 3, amount: 35.52 },
  { id: 'fc_sep_p11', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '05/08 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'CASAS PERNAMBU 02/03', installmentCurrent: 2, installmentTotal: 3, amount: 33.33 },
  { id: 'fc_sep_p12', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '08/08 (Parc)', type: 'card', kind: 'expense', scope: 'shared', category: 'Parcelamentos Cartão', desc: 'BellaCasaGUATA 02/12', installmentCurrent: 2, installmentTotal: 12, amount: 180.00 },
  { id: 'fc_sep_p13', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '21/08 (Parc)', type: 'card', kind: 'expense', scope: 'individual', category: 'Parcelamentos Cartão', desc: 'OBJETIVASAO GO 01/03', installmentCurrent: 1, installmentTotal: 3, amount: 71.67 },

  // Compras e Lançamentos à vista na fatura de Setembro/2026:
  { id: 'fc_sep_v1', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '13/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_sep_v2', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '13/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 89.79 },
  { id: 'fc_sep_v3', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '13/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 7.93 },
  { id: 'fc_sep_v4', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '14/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.95 },
  { id: 'fc_sep_v5', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '14/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'DROGARIAS PACHECO SAMAR MARICA', amount: 14.97 },
  { id: 'fc_sep_v6', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '14/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'Mensalidade - Plano Anuidade Diferenciada', amount: 17.00 },
  { id: 'fc_sep_v7', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '15/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'IFD*IFOOD CLUBOsascoBRA', amount: 7.95 },
  { id: 'fc_sep_v8', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '17/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 13.94 },
  { id: 'fc_sep_v9', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '17/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 22.37 },
  { id: 'fc_sep_v10', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '17/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'MP *DOCEMANIAMaricaBRA', amount: 2.00 },
  { id: 'fc_sep_v11', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '18/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'ESPACO GOURMET MARICA', amount: 30.00 },
  { id: 'fc_sep_v12', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '18/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SUPERMARKET GMAP MARICA', amount: 294.05 },
  { id: 'fc_sep_v13', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '18/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 6.93 },
  { id: 'fc_sep_v14', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '18/08/2026', type: 'card', kind: 'expense', scope: 'individual', category: 'Casa, Serviços & Outros', desc: 'LOJA NEY ACESSORIOS SAO GONCALO', amount: 27.00 },
  { id: 'fc_sep_v15', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '18/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.93 },
  { id: 'fc_sep_v16', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 74.66 },
  { id: 'fc_sep_v17', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'VIDA RAIZ DE MARICA', amount: 44.97 },
  { id: 'fc_sep_v18', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'pagues MARICA serviços', amount: 12.00 },
  { id: 'fc_sep_v19', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 12.95 },
  { id: 'fc_sep_v20', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'Valquiria Pereira MARICA', amount: 8.50 },
  { id: 'fc_sep_v21', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '20/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.94 },
  { id: 'fc_sep_v22', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '21/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_sep_v23', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '22/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'Google One SAO PAULO', amount: 35.99 },
  { id: 'fc_sep_v24', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '22/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 12.95 },
  { id: 'fc_sep_v25', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '23/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'Uber UBER *TRIP HELP.US', amount: 15.96 },
  { id: 'fc_sep_v26', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '23/08/2026', type: 'card', kind: 'reimbursement', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'CANCELAMENTO PARCIAL DE (Estorno)', amount: 50.06 },
  { id: 'fc_sep_v27', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '24/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'Uber UBER *TRIP HELP.US', amount: 9.96 },
  { id: 'fc_sep_v28', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '24/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 24.09 },
  { id: 'fc_sep_v29', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '24/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_sep_v30', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '24/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'GBC COFFEE MARICA', amount: 7.00 },
  { id: 'fc_sep_v31', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 10.95 },
  { id: 'fc_sep_v32', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'MTD*AmorSaude MaricaMar', amount: 17.50 },
  { id: 'fc_sep_v33', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 26.18 },
  { id: 'fc_sep_v34', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 20.79 },
  { id: 'fc_sep_v35', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'MUNDO DOS SUCOS MARICA', amount: 27.50 },
  { id: 'fc_sep_v36', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '25/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'CASAS PEDRO MARICA', amount: 59.13 },
  { id: 'fc_sep_v37', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '26/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.95 },
  { id: 'fc_sep_v38', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '26/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 69.30 },
  { id: 'fc_sep_v39', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '26/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'MP *PEIXARIANS RAA OSASCO', amount: 26.55 },
  { id: 'fc_sep_v40', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '26/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CONVEM MARICA RESTAURANTE', amount: 21.90 },
  { id: 'fc_sep_v41', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '27/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.95 },
  { id: 'fc_sep_v42', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '27/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'DROGARIA FARMAIS MARICA', amount: 21.94 },
  { id: 'fc_sep_v43', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '27/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 26.18 },
  { id: 'fc_sep_v44', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '28/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.96 },
  { id: 'fc_sep_v45', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '28/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 39.27 },
  { id: 'fc_sep_v46', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '28/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'FROGPAY*SILVIA MODAS SAO GONCALO', amount: 37.98 },
  { id: 'fc_sep_v47', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '28/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 30.45 },
  { id: 'fc_sep_v48', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '28/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 7.95 },
  { id: 'fc_sep_v49', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '30/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'GIGIO FITNESS PAC GIGIO MARICA', amount: 169.00 },
  { id: 'fc_sep_v50', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '31/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.95 },
  { id: 'fc_sep_v51', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '31/08/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 81.84 },
  { id: 'fc_sep_v52', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '01/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'TIM*2198396994 1 RIO DE JANEIRO', amount: 55.99 },
  { id: 'fc_sep_v53', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '02/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.94 },
  { id: 'fc_sep_v54', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '02/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'MUNDO DOS SUCOS MARICA', amount: 27.50 },
  { id: 'fc_sep_v55', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '02/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_sep_v56', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '02/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'LANCHE DA GI MARICA', amount: 18.00 },
  { id: 'fc_sep_v57', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '03/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 20.79 },
  { id: 'fc_sep_v58', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '03/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'PESE PATAS ITABORAI', amount: 88.90 },
  { id: 'fc_sep_v59', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '04/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 38.72 },
  { id: 'fc_sep_v60', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '04/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 10.96 },
  { id: 'fc_sep_v61', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '04/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'DROGARIA TAMOIO MARICA', amount: 34.16 },
  { id: 'fc_sep_v62', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '05/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'Edineuza Coelho Da CABO FRIO', amount: 35.00 },
  { id: 'fc_sep_v63', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '05/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'Edineuza Coelho Da CABO FRIO', amount: 3.00 },
  { id: 'fc_sep_v64', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '05/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'Cartao de TODOS set IPATINGA', amount: 33.40 },
  { id: 'fc_sep_v65', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '05/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'RP DUARTE CAVALCANTI CABO FRIO', amount: 8.50 },
  { id: 'fc_sep_v66', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '06/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'Leguste Pizzaria CABO FRIO', amount: 57.19 },
  { id: 'fc_sep_v67', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '06/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'MP *DROGMENORPRECOS OSASCO', amount: 41.00 },
  { id: 'fc_sep_v68', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '07/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.96 },
  { id: 'fc_sep_v69', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '07/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 38.59 },
  { id: 'fc_sep_v70', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '07/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 12.93 },
  { id: 'fc_sep_v71', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '08/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.96 },
  { id: 'fc_sep_v72', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '08/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 29.98 },
  { id: 'fc_sep_v73', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '08/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.94 },
  { id: 'fc_sep_v74', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '09/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'Uber UBER *TRIP HELP.US', amount: 9.95 },
  { id: 'fc_sep_v75', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '10/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.94 },
  { id: 'fc_sep_v76', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '10/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 113.55 },
  { id: 'fc_sep_v77', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '10/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.95 },
  { id: 'fc_sep_v78', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '11/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 26.18 },
  { id: 'fc_sep_v79', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '11/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SUPERMARKET GMAP MARICA', amount: 81.10 },
  { id: 'fc_sep_v80', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '11/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_sep_v81', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-09', date: '11/09/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 10.94 },

  // =====================================================================
  // 2C. LANCHES, CAFÉS E RESTAURANTES NO CARTÃO (OUTUBRO 2026)
  // =====================================================================
  { id: 'fc_l15', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '03/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'NORD PIZZABURGER MARICA', amount: 34.94 },
  { id: 'fc_l16', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 37.07 },
  { id: 'fc_l17', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '06/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'NORD PIZZABURGER MARICA', amount: 33.33 },
  { id: 'fc_l18', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '06/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 36.08 },
  { id: 'fc_l19', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 26.18 },
  { id: 'fc_l20', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '08/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'CHEIRIN BAO - MARICA', amount: 37.07 },

  // 2D. SUPERMERCADO E HORTIFRUTI NO CARTÃO (OUTUBRO 2026)
  { id: 'fc_m9', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 64.45 },
  { id: 'fc_m10', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '06/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 24.02 },
  { id: 'fc_m11', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '08/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'HORTIFRUT JVTA DE MARICA', amount: 31.33 },
  { id: 'fc_m12', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '08/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'SPREZUNIC 745 RIO DE JANEIRO', amount: 31.02 },

  // 2E. UBER E TRANSPORTE NO CARTÃO (OUTUBRO 2026)
  { id: 'fc_u18', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '01/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 8.96 },
  { id: 'fc_u19', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '04/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 14.96 },
  { id: 'fc_u20', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 10.94 },
  { id: 'fc_u21', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.94 },
  { id: 'fc_u22', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 11.93 },
  { id: 'fc_u23', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 12.94 },
  { id: 'fc_u24', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.95 },
  { id: 'fc_u25', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 13.94 },
  { id: 'fc_u26', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '07/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 15.94 },
  { id: 'fc_u27', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '08/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Uber & Transporte', desc: 'DL *UberRides Sao Paulo BR', amount: 9.96 },

  // 2F. ACADEMIA, SAÚDE E FARMÁCIA NO CARTÃO (OUTUBRO 2026)
  { id: 'fc_s5', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '05/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Saúde, Farmácia & Academia', desc: 'Cartao de TODOS IPATINGA', amount: 33.40 },

  // 2G. CASA, SERVIÇOS, ASSINATURAS E PARCELAS NO CARTÃO (OUTUBRO 2026)
  { id: 'fc_o6', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '01/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'TIM 21983969941 RIO DE JANEIRO', amount: 55.99 },
  { id: 'fc_o7', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '01/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'SilvanaCarvalh 01/03 (Serviços São Gonçalo)', installmentCurrent: 1, installmentTotal: 3, amount: 63.34 },
  { id: 'fc_o8', owner: 'Éveli', source: 'Cartão MC Gold', accountId: 'card_eveli_5544', period: '2026-10', date: '01/10/2026', type: 'card', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'BELA FERRAZ MA 01/03', installmentCurrent: 1, installmentTotal: 3, amount: 40.00 },

  // =====================================================================
  // 3. SETEMBRO 2026 (CONTA CORRENTE ITAÚ)
  // =====================================================================
  { id: 'set_1', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '24/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'RSCSS JOSELIA FERR2409', amount: 2.00 },
  { id: 'set_2', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '21/09/2026', type: 'income', kind: 'income', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF VITAL M21/09', amount: 400.00 },
  { id: 'set_3', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '21/09/2026', type: 'debit', kind: 'invoice_payment', scope: 'shared', category: 'Faturas Antigas Pagas', desc: 'FATURA ITAU MULT MC GOLD (Paga em 21/09)', amount: 3375.50 },
  { id: 'set_4', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '21/09/2026', type: 'income', kind: 'income', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF VITAL M21/09', amount: 3000.00 },
  { id: 'set_5', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '18/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'RSCSS CP AMIGAO 31809', amount: 44.93 },
  { id: 'set_6', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '18/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Mercado & Hortifruti', desc: 'RSCSS MUNDO DAS CA1809', amount: 8.00 },
  { id: 'set_7', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '18/09/2026', type: 'income', kind: 'reimbursement', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF DANIEL 18/09', amount: 8.00 },
  { id: 'set_8', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '18/09/2026', type: 'income', kind: 'reimbursement', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF LUCAS M18/09', amount: 8.00 },
  { id: 'set_9', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '18/09/2026', type: 'income', kind: 'reimbursement', scope: 'shared', category: 'Receita', desc: 'PIX TRANSF 58.637.18/09', amount: 8.00 },
  { id: 'set_10', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '17/09/2026', type: 'income', kind: 'income', scope: 'shared', category: 'Receita', desc: 'REND PAGO APLIC AUT MAIS', amount: 0.14 },
  { id: 'set_11', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '17/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Auto Escola & Detran', desc: 'PIX QRS AUTO ESCOLA17/09', amount: 675.00 },
  { id: 'set_12', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '14/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'SEGURO CARTAO', amount: 9.11 },
  { id: 'set_13', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '11/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Lanches & Restaurantes', desc: 'RSCSS CONVEM MARIC1109', amount: 20.90 },
  { id: 'set_14', owner: 'Éveli', source: 'Conta Conjunta Itaú', accountId: 'cc_itau_conjunta', period: '2026-09', date: '08/09/2026', type: 'debit', kind: 'expense', scope: 'shared', category: 'Casa, Serviços & Outros', desc: 'PIX TRANSF Lorrane06/09', amount: 27.32 }
];

function getInitialFamilyData() {
  return {
    activeTab: 'overview',
    selectedPeriod: '2026-10',
    selectedOwner: 'ALL',
    selectedScope: 'ALL',
    includeCurrentCardBill: false,
    cardsConfig: {
      card_eveli_5544: {
        id: 'card_eveli_5544',
        name: 'Cartão Itaú MC Gold (Final 5544)',
        holder: 'Éveli',
        limit: 7740.00,
        closingDay: 14,
        dueDay: 21,
        officialInvoiceTotals: {
          '2026-09': 3375.50,
          '2026-10': 3096.11
        }
      },
      card_marido: {
        id: 'card_marido',
        name: 'Cartão Vital',
        holder: 'Vital',
        limit: 6000.00,
        closingDay: 10,
        dueDay: 17,
        officialInvoiceTotals: {}
      }
    },
    savingsAccounts: {
      tesouro_direto: {
        id: 'tesouro_direto',
        name: 'Tesouro Direto',
        bank: 'Tesouro Nacional / Itaú Corretora',
        type: 'investment',
        holder: 'Casal',
        notes: 'Investimento em Renda Fixa Pública',
        monthlyData: {
          '2026-09': { balance: 8198.11, earnings: 87.37, updatedAt: '30/09/2026' },
          '2026-10': { balance: 8260.70, earnings: 62.59, updatedAt: '22/10/2026' }
        }
      },
      poupanca_itau: {
        id: 'poupanca_itau',
        name: 'Poupança Itaú',
        bank: 'Banco Itaú',
        type: 'savings',
        holder: 'Casal',
        notes: 'Caderneta de Poupança Itaú',
        monthlyData: {
          '2026-09': { balance: 13.36, earnings: 0.09, updatedAt: '30/09/2026' },
          '2026-10': { balance: 13.45, earnings: 0.09, updatedAt: '22/10/2026' }
        }
      },
      poupanca_caixa: {
        id: 'poupanca_caixa',
        name: 'Poupança Caixa Econômica',
        bank: 'Caixa Econômica Federal',
        type: 'savings',
        holder: 'Casal',
        balance: 0.00,
        notes: 'Economias e Reserva da Família (Separada da Conta Corrente Itaú)',
        monthlyData: {
          '2026-09': { balance: 0.00, earnings: 0.00, updatedAt: '30/09/2026' },
          '2026-10': { balance: 0.00, earnings: 0.00, updatedAt: '22/10/2026' }
        }
      }
    },
    importedSources: [
      { id: 's1', owner: 'Éveli', name: 'Conta Conjunta Itaú (Set-Out/26)', type: 'bank' },
      { id: 's2', owner: 'Éveli', name: 'Fatura MC Gold 5544 (Venc 21/10: R$ 3.096,11)', type: 'card' }
    ],
    periodStartingBalances: {
      '2026-09': { amount: 786.79, label: 'Saldo Anterior (Entrada em Setembro/2026)' },
      '2026-10': { amount: 0.00, label: 'Saldo Inicial (Outubro/2026)' },
      'ALL':     { amount: 786.79, label: 'Saldo Inicial' }
    },
    budgets: {
      'Lanches & Restaurantes': 500,
      'Mercado & Hortifruti': 750,
      'Uber & Transporte': 220,
      'Parcelamentos Cartão': 850,
      'Saúde, Farmácia & Academia': 300,
      'Auto Escola & Detran': 450,
      'Casa, Serviços & Outros': 400
    },
    customCategories: [],
    futureGoals: [
      {
        id: 'g1',
        name: 'Guardar Alívio das 4 Parcelas que Acabam em Outubro (SuperBruno + 3 lojas)',
        totalAmount: 1647.52,
        savedAmount: 0,
        remainingMonths: 4,
        postponedCount: 0,
        lastActionNote: 'R$ 411,88/mês ficam livres na fatura a partir de Novembro!'
      },
      {
        id: 'g2',
        name: 'Recompor Reserva de Giro da Conta Conjunta',
        totalAmount: 1000.00,
        savedAmount: 0,
        remainingMonths: 4,
        postponedCount: 0,
        lastActionNote: 'Para nunca precisar usar o Limite da Conta (LIS)'
      },
      {
        id: 'g3',
        name: 'Próximas Despesas CNH / Detran / Documentos',
        totalAmount: 600.00,
        savedAmount: 0,
        remainingMonths: 3,
        postponedCount: 0,
        lastActionNote: 'Planejado em 3x sem apertar o mês'
      }
    ],
    dailyExpenses: [],
    uploadedFiles: [],
    monthlySnapshots: {},
    transactions: enrichTransactionsAndProjectInstallments(baseTransactions)
  };
}
