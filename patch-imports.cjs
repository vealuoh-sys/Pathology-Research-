const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const magicUiImports = `
import { NumberTicker } from './components/magicui/number-ticker';
import { BorderBeam } from './components/magicui/border-beam';
`;
if (!code.includes('NumberTicker')) {
  code = code.replace(/import { Card, Metric, Text, ProgressBar, Badge, BarList, List, ListItem, Tracker } from "@\/components\/tremor";/, `import { Card, Metric, Text, ProgressBar, Badge, BarList, List, ListItem, Tracker } from "@/components/tremor";\n${magicUiImports}`);
  fs.writeFileSync('src/LabResearchAgent.tsx', code);
  console.log("Patched imports");
}
