const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

// Patch 1: Sources Retrieved
code = code.replace(
  /Sources Retrieved \(\{literatureData\.length\}\)/g,
  'Sources Retrieved (<NumberTicker value={literatureData.length} />)'
);

// Patch 2: Citation Count
code = code.replace(
  /\{paper\.citationCount\} Citations<\/span>/g,
  '<NumberTicker value={paper.citationCount} /> Citations</span>'
);

// Patch 3: Border Beam on flags
code = code.replace(
  /bg-\[var\(--bg-paper\)\] border-red-500\/30'\}`\}>/g,
  'bg-[var(--bg-paper)] border-red-500/30 relative overflow-hidden\'}`}>\n                              {!flag.resolved && <BorderBeam size={200} duration={12} colorFrom="var(--status-error)" colorTo="transparent" borderWidth={1.5} />}'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched agent counts and border beam");
