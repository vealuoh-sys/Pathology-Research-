const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /5\. Search Strategy Documentation \(note that we screened \$\{evidencePool\.length\} papers, included \$\{evidencePool\.filter\(d=>d\.included\)\.length\}\)\./g,
  '5. Search Strategy Documentation (note that we screened ${screeningCounts?.deduplicated || evidencePool.length} papers, included ${evidencePool.filter(d=>d.included).length}).'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched prompt");
