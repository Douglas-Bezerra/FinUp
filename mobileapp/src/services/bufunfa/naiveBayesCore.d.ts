export interface ResultadoNaiveBayesPuro {
    intencao: string;
    confianca: number;
    margem: number;
    taxaOOV: number;
    probabilidades: Record<string, number>;
}

export interface AvaliacaoTravasOOD {
    aprovado: boolean;
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
export function classificarNaiveBayesPuro(texto: string): ResultadoNaiveBayesPuro;
export function avaliarTravasOOD(resultadoNB: ResultadoNaiveBayesPuro): AvaliacaoTravasOOD;
