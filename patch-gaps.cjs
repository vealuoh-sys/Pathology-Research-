const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /Identified Gaps \(Select one to proceed\):<\/h4>/g,
  'Identified Gaps (<NumberTicker value={gaps.length} />):</h4>'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched gaps count");
