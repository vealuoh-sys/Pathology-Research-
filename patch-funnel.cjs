const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /subLabel=\{`\$\\{screeningCounts\.deduplicated\\} \/ \$\\{screeningCounts\.initial\\}`\}/g,
  'subLabel={<span className="flex items-center gap-1"><NumberTicker value={screeningCounts.deduplicated} /> / <NumberTicker value={screeningCounts.initial} /></span>}'
);

code = code.replace(
  /subLabel=\{`\$\\{screeningCounts\.included\\} \/ \$\\{screeningCounts\.screened\\}`\}/g,
  'subLabel={<span className="flex items-center gap-1"><NumberTicker value={screeningCounts.included} /> / <NumberTicker value={screeningCounts.screened} /></span>}'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched funnel counts");
