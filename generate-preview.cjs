const m3 = require('m3-tailwind-colors');

const colorsMap = {
  primary: '#0F766E', // Teal 700
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6'
};

const res = m3.M3TailwindRNColors(colorsMap, { scheme: 'tonalSpot', contrast: 0 }, true);

const light = res.light;
const dark = res.dark;

const cssContent = `
@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Playfair Display", ui-serif, Georgia, serif;
}

@layer base {
  :root {
    --bg-app: ${light['background']};
    --bg-paper: ${light['surface-container-lowest']};
    --bg-paper-hover: ${light['surface-container-low']};
    --border-color: ${light['outline-variant']};
    --text-primary: ${light['on-surface']};
    --text-secondary: ${light['on-surface-variant']};
    --text-muted: ${light['outline']};
    
    --accent-primary: ${light['primary']};
    --accent-primary-hover: ${light['on-primary-container']};
    --accent-primary-light: ${light['primary-container']};
    
    --accent-secondary: ${light['secondary']};
    --accent-secondary-hover: ${light['on-secondary-container']};
    --accent-secondary-light: ${light['secondary-container']};
    
    --accent-warm: ${light['tertiary']};
    --accent-warm-hover: ${light['on-tertiary-container']};
    --accent-warm-light: ${light['tertiary-container']};

    --status-success: ${light['success']};
    --status-warning: ${light['warning']};
    --status-error: ${light['error']};
    --status-info: ${light['info']};
    
    --cat-1: ${light['primary']};
    --cat-2: ${light['secondary']};
    --cat-3: ${light['tertiary']};
    --cat-4: ${light['error']};
    --cat-5: ${light['info']};
    --cat-6: ${light['success']};

    /* Preserving the dark sidebar in light mode using M3 inverse tokens */
    --sidebar-bg: ${light['inverse-surface']};
    --sidebar-border: #1E293B; /* Derived from inverse colors manually? Let's use dark mode outline-variant: ${dark['outline-variant']} */
    --sidebar-text: ${light['on-inverse-surface']};
    --sidebar-text-muted: ${dark['on-surface-variant']};
    --sidebar-hover: ${dark['surface-container-low']};
    --sidebar-active: ${light['inverse-primary']};
  }

  .dark {
    --bg-app: ${dark['background']};
    --bg-paper: ${dark['surface-container-lowest']};
    --bg-paper-hover: ${dark['surface-container-low']}; /* wait, dark mode paper-hover in my previous script was #161d1c (on-background... wait surface-container-low is better) */
    --border-color: ${dark['outline-variant']};
    --text-primary: ${dark['on-surface']};
    --text-secondary: ${dark['on-surface-variant']};
    --text-muted: ${dark['outline']};
    
    --accent-primary: ${dark['primary']};
    --accent-primary-hover: ${dark['on-primary-container']};
    --accent-primary-light: ${dark['primary-container']}; /* In dark mode, primary container is darker, which works well for light backgrounds in tags */
    
    --accent-secondary: ${dark['secondary']};
    --accent-secondary-hover: ${dark['on-secondary-container']};
    --accent-secondary-light: ${dark['secondary-container']};
    
    --accent-warm: ${dark['tertiary']};
    --accent-warm-hover: ${dark['on-tertiary-container']};
    --accent-warm-light: ${dark['tertiary-container']};

    --status-success: ${dark['success']};
    --status-warning: ${dark['warning']};
    --status-error: ${dark['error']};
    --status-info: ${dark['info']};
    
    --cat-1: ${dark['primary']};
    --cat-2: ${dark['secondary']};
    --cat-3: ${dark['tertiary']};
    --cat-4: ${dark['error']};
    --cat-5: ${dark['info']};
    --cat-6: ${dark['success']};

    --sidebar-bg: ${dark['surface-container-lowest']};
    --sidebar-border: ${dark['outline-variant']};
    --sidebar-text: ${dark['on-surface']};
    --sidebar-text-muted: ${dark['on-surface-variant']};
    --sidebar-hover: ${dark['surface-container-low']};
    --sidebar-active: ${dark['primary']};
  }
}
`;

console.log(cssContent);
