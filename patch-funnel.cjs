const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /value=\{\(screeningCounts\.included \/ screeningCounts\.screened\) \* 100 \|\| 0\}/,
  'value={(screeningCounts.included / screeningCounts.deduplicated) * 100 || 0}'
);

code = code.replace(
  /subLabel=\{`\$\{screeningCounts\.included\} \/ \$\{screeningCounts\.screened\}`\}/,
  'subLabel={`${screeningCounts.included} / ${screeningCounts.deduplicated}`}'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched funnel UI");
