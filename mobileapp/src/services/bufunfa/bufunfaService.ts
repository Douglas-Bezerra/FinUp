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
    ResultadoClassificacao,
} from "./bufunfaClassifier";

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

    const mesAnteriorResumo: ResumoMesAnterior = {
        mesAno: mesAnoAnterior,
        nomeMes: nomeMesAnterior,
        receitas: receitasMesAnt,
        despesas: despesasMesAnt,
        saldoLiquido: receitasMesAnt - despesasMesAnt,
        despesasPorCategoria: despesasPorCatAnt,
        maiorGasto: despesasPorCatAnt.length > 0 ? despesasPorCatAnt[0] : null,
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

    const menorTexto = ctx.menorGastoCategoria
        ? `\n• Onde gastou menos neste mês: ${ctx.menorGastoCategoria.categoria} (${formatarMoeda(ctx.menorGastoCategoria.total)})`
        : "";

    return `📊 Comparativo: ${ctx.mesReferencia} vs ${ant.nomeMes}:\n\n• Despesas neste mês: ${formatarMoeda(ctx.despesasMes)}\n• Despesas mês passado: ${formatarMoeda(ant.despesas)}\n\n${statusGasto}${maiorTexto}${menorTexto}`;
}

export function gerarRespostaMaiorGasto(ctx: ContextoFinanceiroBufunfa): string {
    if (!ctx.maiorGastoCategoria) {
        return `🔍 Você ainda não tem despesas registradas em ${ctx.mesReferencia}.`;
    }

    return `🏆 Seu maior gasto neste mês foi em "${ctx.maiorGastoCategoria.categoria}":\n\n• Valor: ${formatarMoeda(ctx.maiorGastoCategoria.total)}\n• Representa ${ctx.maiorGastoCategoria.porcentagem.toFixed(1)}% de todas as suas despesas no mês.\n\nTotal de despesas acumuladas: ${formatarMoeda(ctx.despesasMes)} 💡`;
}

export function gerarRespostaMenorGasto(ctx: ContextoFinanceiroBufunfa): string {
    if (!ctx.menorGastoCategoria) {
        return `🔍 Você ainda não tem despesas registradas em ${ctx.mesReferencia}.`;
    }

    return `📉 Seu menor gasto registrado neste mês foi em "${ctx.menorGastoCategoria.categoria}":\n\n• Valor: ${formatarMoeda(ctx.menorGastoCategoria.total)} (${ctx.menorGastoCategoria.porcentagem.toFixed(1)}% das despesas).`;
}

export function gerarRespostaGastoCategoria(
    ctx: ContextoFinanceiroBufunfa,
    categoriaDetectada?: string
): string {
    if (!categoriaDetectada) {
        return gerarRespostaOndeCortarGastos(ctx);
    }

    // Busca exata ou por correspondência parcial
    const match = ctx.despesasPorCategoria.find(
        (c) =>
            c.categoria.toLowerCase().includes(categoriaDetectada.toLowerCase()) ||
            categoriaDetectada.toLowerCase().includes(c.categoria.toLowerCase())
    );

    if (!match) {
        return `🔍 Não encontrei gastos registrados na categoria "${categoriaDetectada}" em ${ctx.mesReferencia}.\n\nSuas categorias com lançamentos este mês são: ${ctx.despesasPorCategoria.map((c) => c.categoria).join(", ") || "nenhuma no momento"}.`;
    }

    return `💳 Seus gastos com "${match.categoria}" em ${ctx.mesReferencia}:\n\n• Total: ${formatarMoeda(match.total)}\n• Representa ${match.porcentagem.toFixed(1)}% das suas despesas do mês.\n\nTotal geral de despesas: ${formatarMoeda(ctx.despesasMes)} 💡`;
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
    if (ctx.despesasPorCategoria.length === 0) {
        return `🔍 Você ainda não possui despesas registradas em ${ctx.mesReferencia}. Assim que registrar compras ou contas, analisarei onde você pode economizar!`;
    }

    const top = ctx.despesasPorCategoria.slice(0, 3);
    const lista = top
        .map(
            (c, i) =>
                `${i + 1}. ${c.categoria}: ${formatarMoeda(c.total)} (${c.porcentagem.toFixed(0)}% das despesas)`
        )
        .join("\n");

    const maior = ctx.maiorGastoCategoria
        ? `\n\nSua maior oportunidade de economia está em "${ctx.maiorGastoCategoria.categoria}". Planejar reduções nessa área fará grande diferença!`
        : "";

    return `🔍 Oportunidades de economia em ${ctx.mesReferencia}:\n\nSuas maiores despesas até agora:\n${lista}${maior}\n\nTotal gasto no mês: ${formatarMoeda(ctx.despesasMes)} 💡`;
}

export function gerarRespostaSaldo(ctx: ContextoFinanceiroBufunfa): string {
    const contasTexto =
        ctx.contas.length > 0
            ? ctx.contas.map((c) => `• ${c.nome}: ${formatarMoeda(c.saldoAtual)}`).join("\n")
            : "Nenhuma conta cadastrada.";

    return `💰 Saldo Total: ${formatarMoeda(ctx.saldoTotal)}\n\nDistribuído nas suas contas:\n${contasTexto}`;
}

export function gerarRespostaGastos(ctx: ContextoFinanceiroBufunfa): string {
    return `💸 Neste mês (${ctx.mesReferencia}), você teve um total de ${formatarMoeda(ctx.despesasMes)} em despesas efetivadas em ${ctx.totalTransacoesMes} movimentação(ões).`;
}

export function gerarRespostaReceitas(ctx: ContextoFinanceiroBufunfa): string {
    return `📈 Neste mês (${ctx.mesReferencia}), suas receitas totalizam ${formatarMoeda(ctx.receitasMes)}.`;
}

/**
 * Processa a mensagem do usuário utilizando o Classificador Naive Bayes local.
 */
export function responderPerguntaComIA(
    texto: string,
    ctx: ContextoFinanceiroBufunfa | null
): { resposta: string; classificacao: ResultadoClassificacao } {
    const classificacao = classificarMensagem(texto);

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

        case "ONDE_GASTEI_MAIS":
            resposta = gerarRespostaMaiorGasto(ctx);
            break;

        case "ONDE_GASTEI_MENOS":
            resposta = gerarRespostaMenorGasto(ctx);
            break;

        case "GASTO_CATEGORIA":
            resposta = gerarRespostaGastoCategoria(ctx, classificacao.categoriaSugerida);
            break;

        case "CONSULTAR_SALDO":
            resposta = gerarRespostaSaldo(ctx);
            break;

        case "CONSULTAR_GASTOS":
            resposta = gerarRespostaGastos(ctx);
            break;

        case "CONSULTAR_RECEITAS":
            resposta = gerarRespostaReceitas(ctx);
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
            )}, Despesas no mês: ${formatarMoeda(ctx.despesasMes)}).\n\nVocê pode me perguntar coisas como:\n• "Compara meus gastos desse mês com mês passado"\n• "Onde gastei mais?" ou "Onde gastei menos?"\n• "Quanto gastei com alimentação?"\n• "Qual é o meu saldo atual?" 💡`;
            break;
    }

    return { resposta, classificacao };
}
