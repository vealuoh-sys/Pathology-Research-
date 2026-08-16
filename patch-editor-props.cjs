const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const regex = /<ManuscriptEditor[\s\S]*?onChange=\{\(newHtml: string\) => \{\n *const newReport = \{ \.\.\.report, \[section\]: newHtml \};\n *setReport\(newReport\);\n *\}\}\n *\/>/;

const newEditorCode = `
                            <ManuscriptEditor
                              initialContent={report[section] || ''}
                              flags={refinementFlags.filter((f: any) => f.section === section)}
                              onChange={(newHtml: string) => {
                                const newReport = { ...report, [section]: newHtml };
                                setReport(newReport);
                              }}
                            />
`;

code = code.replace(regex, newEditorCode.trim());
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched Editor props");
