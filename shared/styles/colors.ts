// shared/styles/colors.ts
// Arquivo de cores para aplicação web e mobile
//==============================================

export const Colors = {
  // ============================================
  // Cores Primárias - Base da identidade visual
  // ============================================
  primary: {
    main: '#2E7D32',      // Verde escuro - Principal
    light: '#4CAF50',     // Verde médio
    lighter: '#E8F5E9',   // Verde claro (fundo de cards)
    dark: '#1B5E20',      // Verde mais escuro
    contrast: '#FFFFFF',  // Branco para contraste
  },

  // ============================================
  // Cores Secundárias - Complementos
  // ============================================
  secondary: {
    main: '#F9A825',      // Amarelo (Caixinha)
    light: '#FFB300',
    dark: '#F57F17',
  },

  // ============================================
  // Feedback Financeiro
  // ============================================
  financial: {
    income: '#2E7D32',    // Verde - Receitas
    expense: '#E53935',   // Vermelho - Despesas
    transfer: '#1976D2',  // Azul - Transferências
    savings: '#F9A825',   // Amarelo - Caixinha
    pending: '#FF9800',   // Laranja - Pendente
    confirmed: '#2E7D32', // Verde - Confirmado
    cancelled: '#B71C1C', // Vermelho escuro - Cancelado
  },

  // ============================================
  // Gráficos e Visualizações
  // ============================================
  charts: {
    income: '#43A047',    // Verde - Barras de receita
    expense: '#E53935',   // Vermelho - Barras de despesa
    grid: '#E0E0E0',      // Cinza claro - Grid
    axis: '#9E9E9E',      // Cinza médio - Eixos
  },

  // ============================================
  // Neutras
  // ============================================
  neutral: {
    white: '#FFFFFF',
    black: '#1A1A1A',     // Preto suave (não #000000)
    grey50: '#FAFAFA',
    grey100: '#F5F5F5',
    grey200: '#EEEEEE',
    grey300: '#E0E0E0',
    grey400: '#BDBDBD',
    grey500: '#9E9E9E',   // Cinza médio
    grey600: '#757575',
    grey700: '#616161',
    grey800: '#424242',
    grey900: '#212121',
  },

  // ============================================
  // Textos
  // ============================================
  text: {
    primary: '#1A1A1A',   // Preto suave
    secondary: '#616161', // Cinza escuro
    tertiary: '#9E9E9E',  // Cinza médio
    light: '#FFFFFF',     // Branco
    link: '#2E7D32',      // Verde para links
  },

  // ============================================
  // Status
  // ============================================
  status: {
    success: '#2E7D32',
    warning: '#F57C00',
    error: '#E53935',
    info: '#1976D2',
  },

  // ============================================
  // Backgrounds e Cards
  // ============================================
  background: {
    default: '#FFFFFF',
    paper: '#F8F9FA',
    card: '#FFFFFF',
    header: '#E8F5E9',    // Verde claro do cabeçalho
    highlight: '#E8F5E9', // Mesmo verde para destaques
  },

  // ============================================
  // Bordas e Sombras
  // ============================================
  border: {
    light: '#EEEEEE',
    medium: '#E0E0E0',
    dark: '#BDBDBD',
  },

  shadow: {
    light: 'rgba(0,0,0,0.08)',
    medium: 'rgba(0,0,0,0.12)',
    dark: 'rgba(0,0,0,0.20)',
  },

  // ============================================
  // Menu Inferior (Bottom Navigation)
  // ============================================
  bottomNav: {
    background: '#FFFFFF',
    active: '#2E7D32',
    inactive: '#9E9E9E',
    shadow: 'rgba(0,0,0,0.08)',
  },
};

// ============================================
// Aliases para uso mais semântico
// ============================================
export const ColorsAlias = {
  // Alias para uso financeiro
  green: Colors.primary.main,
  red: Colors.financial.expense,
  yellow: Colors.secondary.main,
  blue: Colors.financial.transfer,

  // Alias para valores
  positive: Colors.primary.main,
  negative: Colors.financial.expense,
  pending: Colors.financial.pending,

  // Alias para componentes
  header: Colors.background.header,
  cardBackground: Colors.background.card,
  shadow: Colors.shadow.light,
};

export type ColorsType = typeof Colors;
export type ColorKeys = keyof typeof Colors;
