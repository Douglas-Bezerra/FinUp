export interface ResultadoNaiveBayesPuro {
    intencao: string;
    confianca: number;
    margem: number;
    taxaOOV: number;
    probabilidades: Record<string, number>;
}

export interface AnaliseMultiIntent {
    multiIntent: boolean;
    sinais: string[];
    motivo: string | null;
}

export interface AvaliacaoTravasOOD {
    aprovado: boolean;
    multiIntent: boolean;
    motivos: string[];
    motivoResumo: string;
}

export const TRAVAS_OOD: {
    readonly CONFIANCA_MINIMA: number;
    readonly MARGEM_MINIMA: number;
    readonly TAXA_OOV_MAXIMA: number;
};

export function normalizar(texto: string): string;
export function extrairTokens(texto: string): string[];
export function detectarMultiIntent(texto: string): AnaliseMultiIntent;
export function classificarNaiveBayesPuro(texto: string): ResultadoNaiveBayesPuro;
export function avaliarTravasOOD(
    resultadoNB: ResultadoNaiveBayesPuro,
    texto?: string
): AvaliacaoTravasOOD;
