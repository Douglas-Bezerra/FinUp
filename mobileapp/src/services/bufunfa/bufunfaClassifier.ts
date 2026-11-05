import modelData from "./model.json";

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
 * Normaliza o texto removendo acentos e pontuação.
 */
export function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Extrai unigramas e bigramas.
 */
function extrairTokens(texto: string): string[] {
    const limpo = normalizar(texto);
    if (!limpo) return [];
    const palavras = limpo.split(" ").filter((p) => p.length > 1);
    const tokens = [...palavras];

    for (let i = 0; i < palavras.length - 1; i++) {
        tokens.push(`${palavras[i]}_${palavras[i + 1]}`);
    }

    return tokens;
}

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

/**
 * Classifica a mensagem do usuário usando o modelo Naive Bayes pré-treinado e regras de contexto.
 */
export function classificarMensagem(
    texto: string,
    ultimoResultado?: ResultadoClassificacao | null
): ResultadoClassificacao {
    const limpo = normalizar(texto);
    const tokens = extrairTokens(texto);
    const periodo = extrairPeriodo(texto);

    // Tratar follow-ups curtos de conversa (ex: "no mês passado", "e no mês passado?", "e no anterior?")
    const frasesFollowUpPassado = [
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

    if (frasesFollowUpPassado.includes(limpo) && ultimoResultado) {
        return {
            intent: ultimoResultado.intent,
            confidence: 0.95,
            categoriaSugerida: ultimoResultado.categoriaSugerida,
            periodo: "ANTERIOR",
        };
    }

    // Se o texto estiver vazio ou muito curto
    if (tokens.length === 0) {
        return { intent: "DESCONHECIDO", confidence: 0, periodo };
    }

    // Detectar pergunta composta de extremos (MAIS E MENOS juntos)
    const temMais = limpo.includes("mais") || limpo.includes("maior") || limpo.includes("pesou");
    const temMenos = limpo.includes("menos") || limpo.includes("menor") || limpo.includes("barato");

    if (temMais && temMenos && !limpo.includes("compara") && !limpo.includes("comparativo") && !limpo.includes("diferenca")) {
        return {
            intent: "ONDE_GASTEI_MAIS_E_MENOS",
            confidence: 0.98,
            periodo,
        };
    }

    const { classes, logPriors, logLikelihoods, tokenTotals, vocabularioSize } = modelData;

    const scores: Record<string, number> = {};

    classes.forEach((className) => {
        let score = (logPriors as Record<string, number>)[className] || 0;
        const totalTokensClasse = (tokenTotals as Record<string, number>)[className] || 1;
        const defaultLogProb = Math.log(1 / (totalTokensClasse + vocabularioSize));
        const classLikelihoods = (logLikelihoods as Record<string, Record<string, number>>)[className] || {};

        tokens.forEach((token) => {
            if (classLikelihoods[token] !== undefined) {
                score += classLikelihoods[token];
            } else {
                score += defaultLogProb;
            }
        });

        scores[className] = score;
    });

    // Softmax para calcular a probabilidade/confiança
    const maxScore = Math.max(...Object.values(scores));
    const expScores: Record<string, number> = {};
    let sumExp = 0;

    classes.forEach((c) => {
        expScores[c] = Math.exp(scores[c] - maxScore);
        sumExp += expScores[c];
    });

    let topClass = classes[0] as IntencaoBufunfa;
    let topProb = 0;

    classes.forEach((c) => {
        const prob = expScores[c] / sumExp;
        if (prob > topProb) {
            topProb = prob;
            topClass = c as IntencaoBufunfa;
        }
    });

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
