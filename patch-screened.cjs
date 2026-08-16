const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /counts\.screened = docs\.length;/g,
  'counts.screened = counts.deduplicated;'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched counts.screened");
