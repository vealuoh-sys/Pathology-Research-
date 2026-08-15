const m3 = require('m3-tailwind-colors');

const colorsMap = {
  primary: '#0F766E', // Teal 700
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6'
};

const res = m3.M3TailwindRNColors(colorsMap, { scheme: 'tonalSpot', contrast: 0 }, true);

// Let's print out the exact mappings for the user to review.
const light = res.light;
const dark = res.dark;

function printMapping(mode, m) {
    console.log(`\n=== ${mode.toUpperCase()} MODE ===`);
    console.log(`--bg-app: ${m['background']}`);
    console.log(`--bg-paper: ${m['surface-container-lowest']}`);
    console.log(`--bg-paper-hover: ${m['surface-container-low']}`);
    console.log(`--border-color: ${m['outline-variant']}`);
    console.log(`--text-primary: ${m['on-surface']}`);
    console.log(`--text-secondary: ${m['on-surface-variant']}`);
    console.log(`--text-muted: ${m['outline']}`);
    console.log();
    console.log(`--accent-primary: ${m['primary']}`);
    console.log(`--accent-primary-hover: ${m['on-primary-container']}`);
    console.log(`--accent-primary-light: ${m['primary-container']}`);
    console.log();
    console.log(`--accent-secondary: ${m['secondary']}`);
    console.log(`--accent-secondary-hover: ${m['on-secondary-container']}`);
    console.log(`--accent-secondary-light: ${m['secondary-container']}`);
    console.log();
    console.log(`--accent-warm: ${m['tertiary']}`);
    console.log(`--accent-warm-hover: ${m['on-tertiary-container']}`);
    console.log(`--accent-warm-light: ${m['tertiary-container']}`);
    console.log();
    console.log(`--status-success: ${m['success']}`);
    console.log(`--status-warning: ${m['warning']}`);
    console.log(`--status-error: ${m['error']}`);
    console.log(`--status-info: ${m['info']}`);
    console.log();
    console.log(`--cat-1: ${m['primary']}`);
    console.log(`--cat-2: ${m['secondary']}`);
    console.log(`--cat-3: ${m['tertiary']}`);
    console.log(`--cat-4: ${m['error']}`);
    console.log(`--cat-5: ${m['info']}`);
    console.log(`--cat-6: ${m['success']}`);
    console.log();
    console.log(`--sidebar-bg: ${m['surface-container-highest']}`);
    console.log(`--sidebar-border: ${m['outline-variant']}`);
    console.log(`--sidebar-text: ${m['on-surface']}`);
    console.log(`--sidebar-text-muted: ${m['on-surface-variant']}`);
    console.log(`--sidebar-hover: ${m['surface-container-high']}`);
    console.log(`--sidebar-active: ${m['primary']}`);
}

printMapping('light', light);
printMapping('dark', dark);

