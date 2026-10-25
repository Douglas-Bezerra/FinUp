import type { Firestore } from "firebase/firestore";
import type { User } from "firebase/auth";
import {
    obterUsuario,
    listarContas,
    obterExtrato,
} from "../../../../shared/services/finupService";
import type { Conta, Transacao } from "../../../../shared/types/finup";

export interface CategoriaGasto {
    categoria: string;
    total: number;
    porcentagem: number;
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
    totalTransacoesMes: number;
    mesReferencia: string;
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
 * Carrega e consolida o resumo financeiro real do usuário logado diretamente do Firestore.
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

    const dataAtual = new Date();
    const mesAnoAtual = dataAtual.toISOString().slice(0, 7); // AAAA-MM
    const mesNome = dataAtual.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    const transacoesMes = transacoes.filter((t) => {
        if (!t.dataTransacao) return false;
        const dataFormatada =
            t.dataTransacao instanceof Date
                ? t.dataTransacao.toISOString().slice(0, 7)
                : String(t.dataTransacao).slice(0, 7);
        return (
            dataFormatada === mesAnoAtual &&
            t.status === "EFETIVADO" &&
            !t.estornado
        );
    });

    const receitasMes = transacoesMes
        .filter((t) => t.tipoMovimentacao === "RECEITA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const despesasMes = transacoesMes
        .filter((t) => t.tipoMovimentacao === "DESPESA")
        .reduce((total, t) => total + (t.valor || 0), 0);

    const saldoLiquidoMes = receitasMes - despesasMes;

    const taxaPoupanca =
        receitasMes > 0
            ? Math.max(0, Math.round(((receitasMes - despesasMes) / receitasMes) * 100))
            : 0;

    // Agrupar despesas por categoria
    const mapaCategorias: Record<string, number> = {};
    for (const t of transacoesMes) {
        if (t.tipoMovimentacao === "DESPESA") {
            const cat = t.categoriaNome || "Outros";
            mapaCategorias[cat] = (mapaCategorias[cat] || 0) + (t.valor || 0);
        }
    }

    const despesasPorCategoria: CategoriaGasto[] = Object.entries(mapaCategorias)
        .map(([categoria, total]) => ({
            categoria,
            total,
            porcentagem: despesasMes > 0 ? (total / despesasMes) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    const maiorGastoCategoria =
        despesasPorCategoria.length > 0 ? despesasPorCategoria[0] : null;

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
        totalTransacoesMes: transacoesMes.length,
        mesReferencia: mesNome,
    };
}

/**
 * Respostas dinâmicas do Bufunfa geradas a partir dos dados reais do banco.
 */

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
