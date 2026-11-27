import {
    avaliarTravasOOD,
    classificarNaiveBayesPuro,
    detectarMultiIntent,
    extrairTokens,
    normalizar,
    TRAVAS_OOD,
    type AnaliseMultiIntent,
    type AvaliacaoTravasOOD,
    type ResultadoNaiveBayesPuro,
} from "./naiveBayesCore";

export {
    avaliarTravasOOD,
    classificarNaiveBayesPuro,
    detectarMultiIntent,
    extrairTokens,
    normalizar,
    TRAVAS_OOD,
};
export type { AnaliseMultiIntent, AvaliacaoTravasOOD, ResultadoNaiveBayesPuro };

export type IntencaoBufunfa =
    | "COMPARAR_MES_ANTERIOR"
    | "ONDE_GASTEI_MAIS"
    | "ONDE_GASTEI_MENOS"
    | "ONDE_GASTEI_MAIS_E_MENOS"
    | "GASTO_CATEGORIA"
    | "CONSULTAR_SALDO"
    | "CONSULTAR_GASTOS"
    | "CONSULTAR_RECEITAS"
    | "SAUDE_FINANCEIRA"
    | "CORTAR_GASTOS"
    | "DESCONHECIDO";

export type PeriodoConsulta = "ATUAL" | "ANTERIOR";

export interface ResultadoClassificacao {
    intent: IntencaoBufunfa;
    confidence: number;
    categoriaSugerida?: string;
    periodo: PeriodoConsulta;
}

const CATEGORIAS_SINONIMOS: Record<string, string[]> = {
    Alimentação: ["alimentacao", "comida", "mercado", "supermercado", "restaurante", "lanche", "almoco", "jantar", "ifood", "padaria"],
    Transporte: ["transporte", "uber", "gasolina", "combustivel", "onibus", "metro", "passagem", "estacionamento", "pedagio"],
    Moradia: ["moradia", "aluguel", "condominio", "luz", "agua", "gas", "energia", "internet"],
    Saúde: ["saude", "farmacia", "remedio", "medico", "consulta", "dentista", "hospital"],
    Lazer: ["lazer", "cinema", "show", "viagem", "passeio", "bar", "festa", "jogo"],
    Educação: ["educacao", "curso", "faculdade", "escola", "livro", "mensalidade"],
    Assinaturas: ["assinatura", "assinaturas", "streaming", "netflix", "spotify", "prime", "servico"],
    Outros: ["outros", "compras", "roupa", "vestuario", "shopping"],
};

/**
 * Detecta se a pergunta é direcionada ao mês passado/anterior.
 */
export function extrairPeriodo(texto: string): PeriodoConsulta {
    const limpo = normalizar(texto);
    if (
        limpo.includes("mes passado") ||
        limpo.includes("mes anterior") ||
        limpo.includes("no passado") ||
        limpo.includes("do passado") ||
        limpo.includes("anterior") ||
        limpo.includes("passado")
    ) {
        return "ANTERIOR";
    }
    return "ATUAL";
}

/**
 * Extrai categoria do texto se houver correspondência com palavras-chave financeiras.
 */
export function extrairCategoria(texto: string): string | undefined {
    const limpo = normalizar(texto);
    const palavras = limpo.split(" ");

    for (const [categoriaOficial, sinonimos] of Object.entries(CATEGORIAS_SINONIMOS)) {
        for (const s of sinonimos) {
            if (palavras.includes(s) || limpo.includes(s)) {
                return categoriaOficial;
            }
        }
    }

    return undefined;
}

const FRASES_FOLLOW_UP_PASSADO = [
    "no mes passado",
    "mes passado",
    "e no mes passado",
    "e mes passado",
    "no anterior",
    "mes anterior",
    "e no anterior",
    "e no mes anterior",
    "do mes passado",
];

/**
 * Detecta regras determinísticas de contexto (follow-up de período e pergunta composta de extremos).
 */
export function detectarRegraContextual(
    texto: string,
    ultimoResultado?: ResultadoClassificacao | null
): ResultadoClassificacao | null {
    const limpo = normalizar(texto);
    const periodo = extrairPeriodo(texto);

    if (
        FRASES_FOLLOW_UP_PASSADO.includes(limpo) &&
        ultimoResultado &&
        ultimoResultado.intent !== "DESCONHECIDO"
    ) {
        return {
            intent: ultimoResultado.intent,
            confidence: 0.95,
            categoriaSugerida: ultimoResultado.categoriaSugerida,
            periodo: "ANTERIOR",
        };
    }

    if (detectarMultiIntent(texto).multiIntent) {
        return null;
    }

    const temMais = limpo.includes("mais") || limpo.includes("maior") || limpo.includes("pesou");
    const temMenos = limpo.includes("menos") || limpo.includes("menor") || limpo.includes("barato");

    if (
        temMais &&
        temMenos &&
        !limpo.includes("compar") &&
        !limpo.includes("diferenca")
    ) {
        return {
            intent: "ONDE_GASTEI_MAIS_E_MENOS",
            confidence: 0.98,
            periodo,
        };
    }

    return null;
}

/**
 * Classifica a mensagem do usuário usando o modelo Naive Bayes pré-treinado e regras de contexto.
 */
export function classificarMensagem(
    texto: string,
    ultimoResultado?: ResultadoClassificacao | null
): ResultadoClassificacao {
    const tokens = extrairTokens(texto);
    const periodo = extrairPeriodo(texto);

    const regraContextual = detectarRegraContextual(texto, ultimoResultado);
    if (regraContextual) {
        return regraContextual;
    }

    // Se o texto estiver vazio ou muito curto
    if (tokens.length === 0) {
        return { intent: "DESCONHECIDO", confidence: 0, periodo };
    }

    const resultadoNB = classificarNaiveBayesPuro(texto);
    let topClass = resultadoNB.intencao as IntencaoBufunfa;
    const topProb = resultadoNB.confianca;

    const categoriaDetectada = extrairCategoria(texto);

    // Se o usuário citou expressamente uma categoria (ex: "quanto gastei com comida?"), promove a intenção
    if (categoriaDetectada && (topClass === "CONSULTAR_GASTOS" || topClass === "ONDE_GASTEI_MAIS")) {
        topClass = "GASTO_CATEGORIA";
    }

    // Se a confiança for excessivamente baixa (< 0.25), consideramos fora de domínio
    if (topProb < 0.25) {
        return {
            intent: "DESCONHECIDO",
            confidence: topProb,
            categoriaSugerida: categoriaDetectada,
            periodo,
        };
    }

    return {
        intent: topClass,
        confidence: topProb,
        categoriaSugerida: categoriaDetectada,
        periodo,
    };
}
