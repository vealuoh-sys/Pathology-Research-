const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf-8');

if (!code.includes('--animate-border-beam')) {
  code = code.replace(/@theme \{/, '@theme {\n  --animate-border-beam: border-beam calc(var(--duration)*1s) infinite linear;\n  @keyframes border-beam {\n    100% {\n      offset-distance: 100%;\n    }\n  }');
  fs.writeFileSync('src/index.css', code);
  console.log('Patched index.css with border-beam keyframes');
}
