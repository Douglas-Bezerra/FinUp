import type { Firestore } from "firebase/firestore";
import type { User } from "firebase/auth";
import {
    obterUsuario,
    listarContas,
    obterExtrato,
} from "../../../../shared/services/finupService";
import type { Conta, Transacao } from "../../../../shared/types/finup";
import {
    classificarMensagem,
    IntencaoBufunfa,
    PeriodoConsulta,
    ResultadoClassificacao,
} from "./bufunfaClassifier";
export type { ResultadoClassificacao, IntencaoBufunfa, PeriodoConsulta };

export interface CategoriaGasto {
    categoria: string;
    total: number;
    porcentagem: number;
}

export interface ResumoMesAnterior {
    mesAno: string;
    nomeMes: string;
    receitas: number;
    despesas: number;
    saldoLiquido: number;
    despesasPorCategoria: CategoriaGasto[];
    maiorGasto: CategoriaGasto | null;
    menorGasto: CategoriaGasto | null;
}

export interface ContextoFinanceiroBufunfa {
    nomeUsuario: string;
    saldoTotal: number;
    contas: Array<{
        id: string;
        nome: string;
        saldoAtual: number;
        tipoConta: string;
    }>;
    receitasMes: number;
    despesasMes: number;
    saldoLiquidoMes: number;
    taxaPoupanca: number;
    despesasPorCategoria: CategoriaGasto[];
    maiorGastoCategoria: CategoriaGasto | null;
    menorGastoCategoria: CategoriaGasto | null;
    totalTransacoesMes: number;
    mesReferencia: string;
    mesAnterior: ResumoMesAnterior | null;
}

/**
 * Formata um número no padrão monetário brasileiro (BRL).
 */
export function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    });
}

/**
 * Normaliza data para string AAAA-MM
 */
function obterMesAno(data: any): string {
    if (!data) return "";
    if (data instanceof Date) {
        return data.toISOString().slice(0, 7);
    }
    return String(data).slice(0, 7);
}

/**
 * Carrega e consolida o histórico financeiro real do usuário logado via Firestore.
 */
export async function carregarContextoBufunfa(
    db: Firestore,
    currentUser: User | null
): Promise<ContextoFinanceiroBufunfa> {
    if (!currentUser) {
        throw new Error("Usuário não autenticado.");
    }

    const perfil = await obterUsuario(db, currentUser.uid);
    if (!perfil) {
        throw new Error("Perfil financeiro não encontrado.");
    }

    const [contas, transacoes] = await Promise.all([
        listarContas(db, perfil.familiaId),
        obterExtrato(db, perfil.familiaId),
    ]);

    const saldoTotal = contas
        .filter((c) => c.ativo !== false)
        .reduce((total, c) => total + (c.saldoAtual || 0), 0);

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtualNum = agora.getMonth(); // 0 a 11

    const mesAnoAtual = `${anoAtual}-${String(mesAtualNum + 1).padStart(2, "0")}`;

    // Calcular mês anterior
    const dataMesAnterior = new Date(anoAtual, mesAtualNum - 1, 1);
    const mesAnoAnterior = `${dataMesAnterior.getFullYear()}-${String(
        dataMesAnterior.getMonth() + 1
    ).padStart(2, "0")}`;

    const nomeMesAtual = agora.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    const nomeMesAnterior = dataMesAnterior.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    // 1. Filtrar transações efetivadas deste mês
    const transacoesMesAtual = transacoes.filter((t) => {
        return (
            obterMesAno(t.dataTransacao) === mesAnoAtual &&
            t.status === "EFETIVADO" &&
            !t.estornado
        );
    });

    // 2. Filtrar transações efetivadas do mês anterior
    const transacoesMesAnterior = transacoes.filter((t) => {
        return (
            obterMesAno(t.dataTransacao) === mesAnoAnterior &&
            t.status === "EFETIVADO" &&
            !t.estornado
        );
    });

    // Métricas do Mês Atual
    const receitasMes = transacoesMesAtual
        .filter((t) => t.tipoMovimentacao === "RECEITA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const despesasMes = transacoesMesAtual
        .filter((t) => t.tipoMovimentacao === "DESPESA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const saldoLiquidoMes = receitasMes - despesasMes;

    const taxaPoupanca =
        receitasMes > 0
            ? Math.max(0, Math.round(((receitasMes - despesasMes) / receitasMes) * 100))
            : 0;

    // Agrupar categorias do mês atual
    const mapaCatAtual: Record<string, number> = {};
    for (const t of transacoesMesAtual) {
        if (t.tipoMovimentacao === "DESPESA") {
            const cat = t.categoriaNome || "Outros";
            mapaCatAtual[cat] = (mapaCatAtual[cat] || 0) + (t.valor || 0);
        }
    }

    const despesasPorCategoria: CategoriaGasto[] = Object.entries(mapaCatAtual)
        .map(([categoria, total]) => ({
            categoria,
            total,
            porcentagem: despesasMes > 0 ? (total / despesasMes) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    const maiorGastoCategoria =
        despesasPorCategoria.length > 0 ? despesasPorCategoria[0] : null;

    const menorGastoCategoria =
        despesasPorCategoria.length > 0
            ? despesasPorCategoria[despesasPorCategoria.length - 1]
            : null;

    // Métricas do Mês Anterior
    const receitasMesAnt = transacoesMesAnterior
        .filter((t) => t.tipoMovimentacao === "RECEITA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const despesasMesAnt = transacoesMesAnterior
        .filter((t) => t.tipoMovimentacao === "DESPESA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const mapaCatAnt: Record<string, number> = {};
    for (const t of transacoesMesAnterior) {
        if (t.tipoMovimentacao === "DESPESA") {
            const cat = t.categoriaNome || "Outros";
            mapaCatAnt[cat] = (mapaCatAnt[cat] || 0) + (t.valor || 0);
        }
    }

    const despesasPorCatAnt: CategoriaGasto[] = Object.entries(mapaCatAnt)
        .map(([categoria, total]) => ({
            categoria,
            total,
            porcentagem: despesasMesAnt > 0 ? (total / despesasMesAnt) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    const maiorGastoAnt =
        despesasPorCatAnt.length > 0 ? despesasPorCatAnt[0] : null;

    const menorGastoAnt =
        despesasPorCatAnt.length > 0
            ? despesasPorCatAnt[despesasPorCatAnt.length - 1]
            : null;

    const mesAnteriorResumo: ResumoMesAnterior = {
        mesAno: mesAnoAnterior,
        nomeMes: nomeMesAnterior,
        receitas: receitasMesAnt,
        despesas: despesasMesAnt,
        saldoLiquido: receitasMesAnt - despesasMesAnt,
        despesasPorCategoria: despesasPorCatAnt,
        maiorGasto: maiorGastoAnt,
        menorGasto: menorGastoAnt,
    };

    return {
        nomeUsuario: perfil.nome || "Usuário",
        saldoTotal,
        contas: contas.map((c) => ({
            id: c.id,
            nome: c.nome,
            saldoAtual: c.saldoAtual || 0,
            tipoConta: c.tipoConta,
        })),
        receitasMes,
        despesasMes,
        saldoLiquidoMes,
        taxaPoupanca,
        despesasPorCategoria,
        maiorGastoCategoria,
        menorGastoCategoria,
        totalTransacoesMes: transacoesMesAtual.length,
        mesReferencia: nomeMesAtual,
        mesAnterior: mesAnteriorResumo,
    };
}

/**
 * Gera análise comparativa detalhada entre o mês atual e o mês anterior.
 */
export function gerarRespostaComparativoMesAnterior(
    ctx: ContextoFinanceiroBufunfa
): string {
    const ant = ctx.mesAnterior;

    if (!ant || (ant.despesas === 0 && ant.receitas === 0)) {
        return `📊 Comparativo Mensal:\n\nAinda não encontrei registros completos no mês anterior (${ant?.nomeMes || "passado"}) para traçar o comparativo.\n\nNeste mês (${ctx.mesReferencia}), você já teve ${formatarMoeda(ctx.despesasMes)} em despesas e ${formatarMoeda(ctx.receitasMes)} em receitas. Assim que houver histórico em ambos os meses, farei um comparativo detalhado! 💡`;
    }

    // Se neste mês ainda não há despesas, mas no mês anterior há:
    if (ctx.despesasMes === 0 && ant.despesas > 0) {
        const maiorAnt = ant.maiorGasto
            ? `\n• 🏆 Maior gasto mês passado: ${ant.maiorGasto.categoria} (${formatarMoeda(ant.maiorGasto.total)})`
            : "";
        const menorAnt =
            ant.menorGasto && ant.menorGasto.categoria !== ant.maiorGasto?.categoria
                ? `\n• 📉 Menor gasto mês passado: ${ant.menorGasto.categoria} (${formatarMoeda(ant.menorGasto.total)})`
                : "";

        return `📊 Comparativo: ${ctx.mesReferencia} vs ${ant.nomeMes}:\n\n• Despesas neste mês: ${formatarMoeda(ctx.despesasMes)} (sem lançamentos ainda)\n• Despesas mês passado: ${formatarMoeda(ant.despesas)}\n\nNo mês passado (${ant.nomeMes}):${maiorAnt}${menorAnt}\n\n💡 Conforme você registrar os gastos deste mês, vou comparando onde aumentou e onde diminuiu!`;
    }

    const difDespesas = ctx.despesasMes - ant.despesas;
    const variacaoPct =
        ant.despesas > 0
            ? ((difDespesas / ant.despesas) * 100).toFixed(1)
            : "0";

    const statusGasto =
        difDespesas > 0
            ? `🔺 Você gastou ${formatarMoeda(difDespesas)} (+${variacaoPct}%) a mais que no mês anterior.`
            : difDespesas < 0
            ? `🟢 Parabéns! Você economizou ${formatarMoeda(Math.abs(difDespesas))} (-${Math.abs(Number(variacaoPct))}%) em relação ao mês anterior.`
            : `⚖️ Seus gastos estão exatamente iguais aos do mês anterior.`;

    const maiorTexto = ctx.maiorGastoCategoria
        ? `\n• Onde gastou mais neste mês: ${ctx.maiorGastoCategoria.categoria} (${formatarMoeda(ctx.maiorGastoCategoria.total)})`
        : "";

    const menorTexto =
        ctx.menorGastoCategoria &&
        ctx.menorGastoCategoria.categoria !== ctx.maiorGastoCategoria?.categoria
            ? `\n• Onde gastou menos neste mês: ${ctx.menorGastoCategoria.categoria} (${formatarMoeda(ctx.menorGastoCategoria.total)})`
            : "";

    const antTexto = ant.maiorGasto
        ? `\n• Maior gasto no mês passado (${ant.nomeMes}): ${ant.maiorGasto.categoria} (${formatarMoeda(ant.maiorGasto.total)})`
        : "";

    return `📊 Comparativo: ${ctx.mesReferencia} vs ${ant.nomeMes}:\n\n• Despesas neste mês: ${formatarMoeda(ctx.despesasMes)}\n• Despesas mês passado: ${formatarMoeda(ant.despesas)}\n\n${statusGasto}${maiorTexto}${menorTexto}${antTexto}`;
}

/**
 * Responde onde o usuário gastou mais, menos ou ambos, no mês atual ou anterior.
 */
export function gerarRespostaExtremosGastos(
    ctx: ContextoFinanceiroBufunfa,
    modo: "MAIS" | "MENOS" | "AMBOS",
    periodo: PeriodoConsulta
): string {
    const alvo = periodo === "ANTERIOR" ? ctx.mesAnterior : null;
    const nomeMes = alvo ? alvo.nomeMes : ctx.mesReferencia;
    const despesas = alvo ? alvo.despesas : ctx.despesasMes;
    const maior = alvo ? alvo.maiorGasto : ctx.maiorGastoCategoria;
    const menor = alvo ? alvo.menorGasto : ctx.menorGastoCategoria;

    // Se o período pedido não tem despesas
    if (despesas === 0 || !maior) {
        if (periodo === "ATUAL" && ctx.mesAnterior && ctx.mesAnterior.despesas > 0) {
            const ant = ctx.mesAnterior;
            let complemento = "";
            if (modo === "AMBOS" && ant.maiorGasto) {
                const menorInfo = ant.menorGasto && ant.menorGasto.categoria !== ant.maiorGasto.categoria
                    ? `\n• 📉 Menor gasto: ${ant.menorGasto.categoria} (${formatarMoeda(ant.menorGasto.total)})`
                    : "";
                complemento = `\n\nNo entanto, no mês passado (${ant.nomeMes}), seus registros foram:\n• 🏆 Maior gasto: ${ant.maiorGasto.categoria} (${formatarMoeda(ant.maiorGasto.total)})${menorInfo}\n• Total de despesas: ${formatarMoeda(ant.despesas)} 💡`;
            } else if (modo === "MAIS" && ant.maiorGasto) {
                complemento = `\n\nNo mês passado (${ant.nomeMes}), seu maior gasto foi em "${ant.maiorGasto.categoria}" (${formatarMoeda(ant.maiorGasto.total)}).`;
            } else if (modo === "MENOS" && ant.menorGasto) {
                complemento = `\n\nNo mês passado (${ant.nomeMes}), seu menor gasto foi em "${ant.menorGasto.categoria}" (${formatarMoeda(ant.menorGasto.total)}).`;
            }
            return `🔍 Você ainda não tem despesas registradas em ${nomeMes}.${complemento}`;
        }
        return `🔍 Não há despesas registradas em ${nomeMes}.`;
    }

    if (modo === "AMBOS") {
        const menorTexto =
            menor && menor.categoria !== maior.categoria
                ? `\n• 📉 Menor gasto: ${menor.categoria} (${formatarMoeda(menor.total)})`
                : "";
        return `📊 Gastos em ${nomeMes}:\n\n• 🏆 Maior gasto: ${maior.categoria} (${formatarMoeda(maior.total)})\n  ↳ Representa ${maior.porcentagem.toFixed(1)}% das despesas${menorTexto}\n\nTotal de despesas: ${formatarMoeda(despesas)} 💡`;
    }

    if (modo === "MAIS") {
        return `🏆 Seu maior gasto em ${nomeMes} foi em "${maior.categoria}":\n\n• Valor: ${formatarMoeda(maior.total)}\n• Representa ${maior.porcentagem.toFixed(1)}% das suas despesas.\n\nTotal de despesas acumuladas: ${formatarMoeda(despesas)} 💡`;
    }

    // modo === "MENOS"
    if (menor) {
        return `📉 Seu menor gasto registrado em ${nomeMes} foi em "${menor.categoria}":\n\n• Valor: ${formatarMoeda(menor.total)} (${menor.porcentagem.toFixed(1)}% das despesas).\n\nTotal de despesas: ${formatarMoeda(despesas)} 💡`;
    }

    return `📉 Seu menor gasto em ${nomeMes} foi em "${maior.categoria}" (${formatarMoeda(maior.total)}).`;
}

export function gerarRespostaGastoCategoria(
    ctx: ContextoFinanceiroBufunfa,
    categoriaDetectada?: string,
    periodo: PeriodoConsulta = "ATUAL"
): string {
    if (!categoriaDetectada) {
        return gerarRespostaOndeCortarGastos(ctx);
    }

    const listaCategorias =
        periodo === "ANTERIOR" && ctx.mesAnterior
            ? ctx.mesAnterior.despesasPorCategoria
            : ctx.despesasPorCategoria;

    const nomeMes =
        periodo === "ANTERIOR" && ctx.mesAnterior
            ? ctx.mesAnterior.nomeMes
            : ctx.mesReferencia;

    const totalDespesas =
        periodo === "ANTERIOR" && ctx.mesAnterior
            ? ctx.mesAnterior.despesas
            : ctx.despesasMes;

    // Busca exata ou por correspondência parcial
    const match = listaCategorias.find(
        (c) =>
            c.categoria.toLowerCase().includes(categoriaDetectada.toLowerCase()) ||
            categoriaDetectada.toLowerCase().includes(c.categoria.toLowerCase())
    );

    if (!match) {
        return `🔍 Não encontrei gastos registrados na categoria "${categoriaDetectada}" em ${nomeMes}.\n\nSuas categorias com lançamentos em ${nomeMes} são: ${
            listaCategorias.map((c) => c.categoria).join(", ") || "nenhuma no momento"
        }.`;
    }

    return `💳 Seus gastos com "${match.categoria}" em ${nomeMes}:\n\n• Total: ${formatarMoeda(match.total)}\n• Representa ${match.porcentagem.toFixed(1)}% das suas despesas do mês.\n\nTotal geral de despesas: ${formatarMoeda(totalDespesas)} 💡`;
}

export function gerarRespostaSaudeFinanceira(ctx: ContextoFinanceiroBufunfa): string {
    if (ctx.receitasMes === 0 && ctx.despesasMes === 0) {
        return `📊 Análise de ${ctx.mesReferencia}:\n\nAinda não encontrei movimentações registradas neste mês. Seu saldo total disponível em contas é de ${formatarMoeda(ctx.saldoTotal)}.\n\nConforme você registrar suas receitas e despesas, vou te dar um diagnóstico completo da sua saúde financeira! 💡`;
    }

    if (ctx.saldoLiquidoMes >= 0) {
        return `📊 Análise de ${ctx.mesReferencia}:\n\nSua saúde financeira está boa! Neste mês você economizou ${formatarMoeda(ctx.saldoLiquidoMes)} (${ctx.taxaPoupanca}% da sua renda).\n\n• Receitas: +${formatarMoeda(ctx.receitasMes)}\n• Despesas: -${formatarMoeda(ctx.despesasMes)}\n• Saldo total em contas: ${formatarMoeda(ctx.saldoTotal)}\n\nTaxa de poupança positiva, continue assim! 🎯`;
    }

    return `⚠️ Atenção às contas em ${ctx.mesReferencia}:\n\nSuas despesas superaram suas receitas neste mês por ${formatarMoeda(Math.abs(ctx.saldoLiquidoMes))}.\n\n• Receitas: +${formatarMoeda(ctx.receitasMes)}\n• Despesas: -${formatarMoeda(ctx.despesasMes)}\n• Saldo total disponível em contas: ${formatarMoeda(ctx.saldoTotal)}\n\nDica do Bufunfa: avalie cortar gastos não essenciais para reequilibrar o mês! 💡`;
}

export function gerarRespostaOndeCortarGastos(ctx: ContextoFinanceiroBufunfa): string {
    const lista =
        ctx.despesasPorCategoria.length > 0
            ? ctx.despesasPorCategoria
            : ctx.mesAnterior?.despesasPorCategoria || [];

    const nomeMes =
        ctx.despesasPorCategoria.length > 0
            ? ctx.mesReferencia
            : ctx.mesAnterior?.nomeMes || ctx.mesReferencia;

    const totalDespesas =
        ctx.despesasPorCategoria.length > 0
            ? ctx.despesasMes
            : ctx.mesAnterior?.despesas || 0;

    if (lista.length === 0) {
        return `🔍 Você ainda não possui despesas registradas. Assim que registrar compras ou contas, analisarei onde você pode economizar!`;
    }

    const top = lista.slice(0, 3);
    const listaTexto = top
        .map(
            (c, i) =>
                `${i + 1}. ${c.categoria}: ${formatarMoeda(c.total)} (${c.porcentagem.toFixed(0)}% das despesas)`
        )
        .join("\n");

    const maior = top.length > 0
        ? `\n\nSua maior oportunidade de economia está em "${top[0].categoria}". Planejar reduções nessa área fará grande diferença!`
        : "";

    return `🔍 Oportunidades de economia baseadas em ${nomeMes}:\n\nSuas maiores despesas:\n${listaTexto}${maior}\n\nTotal gasto no período: ${formatarMoeda(totalDespesas)} 💡`;
}

export function gerarRespostaSaldo(ctx: ContextoFinanceiroBufunfa): string {
    const contasTexto =
        ctx.contas.length > 0
            ? ctx.contas.map((c) => `• ${c.nome}: ${formatarMoeda(c.saldoAtual)}`).join("\n")
            : "Nenhuma conta cadastrada.";

    return `💰 Saldo Total: ${formatarMoeda(ctx.saldoTotal)}\n\nDistribuído nas suas contas:\n${contasTexto}`;
}

export function gerarRespostaGastos(
    ctx: ContextoFinanceiroBufunfa,
    periodo: PeriodoConsulta = "ATUAL"
): string {
    if (periodo === "ANTERIOR" && ctx.mesAnterior) {
        return `💸 No mês passado (${ctx.mesAnterior.nomeMes}), você teve um total de ${formatarMoeda(ctx.mesAnterior.despesas)} em despesas efetivadas.`;
    }
    return `💸 Neste mês (${ctx.mesReferencia}), você teve um total de ${formatarMoeda(ctx.despesasMes)} em despesas efetivadas em ${ctx.totalTransacoesMes} movimentação(ões).`;
}

export function gerarRespostaReceitas(
    ctx: ContextoFinanceiroBufunfa,
    periodo: PeriodoConsulta = "ATUAL"
): string {
    if (periodo === "ANTERIOR" && ctx.mesAnterior) {
        return `📈 No mês passado (${ctx.mesAnterior.nomeMes}), suas receitas totalizaram ${formatarMoeda(ctx.mesAnterior.receitas)}.`;
    }
    return `📈 Neste mês (${ctx.mesReferencia}), suas receitas totalizam ${formatarMoeda(ctx.receitasMes)}.`;
}

/**
 * Processa a mensagem do usuário utilizando o Classificador Naive Bayes local e contexto conversacional.
 */
export function responderPerguntaComIA(
    texto: string,
    ctx: ContextoFinanceiroBufunfa | null,
    ultimoResultado?: ResultadoClassificacao | null
): { resposta: string; classificacao: ResultadoClassificacao } {
    const classificacao = classificarMensagem(texto, ultimoResultado);

    if (!ctx) {
        return {
            resposta:
                "Entendido! 📝 Estou conectando aos seus dados financeiros... Tente me perguntar novamente em alguns instantes!",
            classificacao,
        };
    }

    let resposta = "";

    switch (classificacao.intent) {
        case "COMPARAR_MES_ANTERIOR":
            resposta = gerarRespostaComparativoMesAnterior(ctx);
            break;

        case "ONDE_GASTEI_MAIS_E_MENOS":
            resposta = gerarRespostaExtremosGastos(ctx, "AMBOS", classificacao.periodo);
            break;

        case "ONDE_GASTEI_MAIS":
            resposta = gerarRespostaExtremosGastos(ctx, "MAIS", classificacao.periodo);
            break;

        case "ONDE_GASTEI_MENOS":
            resposta = gerarRespostaExtremosGastos(ctx, "MENOS", classificacao.periodo);
            break;

        case "GASTO_CATEGORIA":
            resposta = gerarRespostaGastoCategoria(
                ctx,
                classificacao.categoriaSugerida,
                classificacao.periodo
            );
            break;

        case "CONSULTAR_SALDO":
            resposta = gerarRespostaSaldo(ctx);
            break;

        case "CONSULTAR_GASTOS":
            resposta = gerarRespostaGastos(ctx, classificacao.periodo);
            break;

        case "CONSULTAR_RECEITAS":
            resposta = gerarRespostaReceitas(ctx, classificacao.periodo);
            break;

        case "SAUDE_FINANCEIRA":
            resposta = gerarRespostaSaudeFinanceira(ctx);
            break;

        case "CORTAR_GASTOS":
            resposta = gerarRespostaOndeCortarGastos(ctx);
            break;

        default:
            resposta = `Entendido! 📝 Analisei suas finanças atuais (Saldo total: ${formatarMoeda(
                ctx.saldoTotal
            )}, Despesas no mês: ${formatarMoeda(ctx.despesasMes)}).\n\nVocê pode me perguntar coisas como:\n• "Compara meus gastos desse mês com mês passado"\n• "Onde gastei mais e onde gastei menos no mês passado"\n• "Quanto gastei com alimentação?"\n• "Qual é o meu saldo atual?" 💡`;
            break;
    }

    return { resposta, classificacao };
}
