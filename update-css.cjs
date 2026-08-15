const fs = require('fs');

const css = fs.readFileSync('src/index.css', 'utf-8');

const newRootAndDark = `:root {
    --bg-app: #f4fbf8;
    --bg-paper: #ffffff;
    --bg-paper-hover: #eff5f3;
    --border-color: #bec9c6;
    --text-primary: #161d1c;
    --text-secondary: #3f4947;
    --text-muted: #6f7977;
    
    --accent-primary: #006a63;
    --accent-primary-hover: #00504a;
    --accent-primary-light: #9df2e7;
    
    --accent-secondary: #4a6360;
    --accent-secondary-hover: #324b48;
    --accent-secondary-light: #cce8e4;
    
    --accent-warm: #47617a;
    --accent-warm-hover: #2f4961;
    --accent-warm-light: #cee5ff;

    --status-success: #006b58;
    --status-warning: #795900;
    --status-error: #ba1a1a;
    --status-info: #0062a0;
    
    --cat-1: #006a63;
    --cat-2: #4a6360;
    --cat-3: #47617a;
    --cat-4: #ba1a1a;
    --cat-5: #0062a0;
    --cat-6: #006b58;

    /* Preserving the dark sidebar in light mode via M3 Inverse Tokens */
    --sidebar-bg: #2b3231;
    --sidebar-border: #3f4947; 
    --sidebar-text: #ecf2f0;
    --sidebar-text-muted: #bec9c6;
    --sidebar-hover: #161d1c;
    --sidebar-active: #81d5cb;
  }

  .dark {
    --bg-app: #0e1514;
    --bg-paper: #090f0e;
    --bg-paper-hover: #161d1c;
    --border-color: #3f4947;
    --text-primary: #dde4e2;
    --text-secondary: #bec9c6;
    --text-muted: #899391;
    
    --accent-primary: #81d5cb;
    --accent-primary-hover: #9df2e7;
    --accent-primary-light: #00504a; 
    
    --accent-secondary: #b1ccc8;
    --accent-secondary-hover: #cce8e4;
    --accent-secondary-light: #324b48;
    
    --accent-warm: #aec9e6;
    --accent-warm-hover: #cee5ff;
    --accent-warm-light: #2f4961;

    --status-success: #4bddbb;
    --status-warning: #f8bd26;
    --status-error: #ffb4ab;
    --status-info: #9bcbff;
    
    --cat-1: #81d5cb;
    --cat-2: #b1ccc8;
    --cat-3: #aec9e6;
    --cat-4: #ffb4ab;
    --cat-5: #9bcbff;
    --cat-6: #4bddbb;

    --sidebar-bg: #090f0e;
    --sidebar-border: #3f4947;
    --sidebar-text: #dde4e2;
    --sidebar-text-muted: #bec9c6;
    --sidebar-hover: #161d1c;
    --sidebar-active: #81d5cb;
  }`;

// Use regex to replace the old contents inside @layer base {...}
// We match from `:root {` down to the closing brace of `.dark { ... }`
const regex = /:root\s*\{[\s\S]*?\.dark\s*\{[\s\S]*?\}\s*\n/m;
const newCss = css.replace(regex, newRootAndDark + '\n');

fs.writeFileSync('src/index.css', newCss);

console.log("Updated src/index.css!");
