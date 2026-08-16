const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const importStatement = `import { ManuscriptEditor } from './ManuscriptEditor';\n`;
code = importStatement + code;

const editorCode = `
                          ) : (
                            <ManuscriptEditor
                              initialContent={
                                // Convert markdown to simple HTML and highlight flagged quotes
                                (() => {
                                   let html = report[section] || '';
                                   // simple markdown to HTML for paragraphs
                                   html = html.replace(/\\n\\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>');
                                   html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                                   
                                   // highlight flags
                                   const flags = refinementFlags.filter((f: any) => f.section === section);
                                   flags.forEach((f: any) => {
                                      if (f.quote) {
                                         // highlight verbatim quote
                                         const highlighted = \`<mark style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 4px; padding: 0 4px;">\${f.quote}</mark>\`;
                                         html = html.replace(f.quote, highlighted);
                                      }
                                   });
                                   return html;
                                })()
                              }
                              onChange={(newHtml: string) => {
                                const newReport = { ...report, [section]: newHtml };
                                setReport(newReport);
                              }}
                            />
                          )
`;

code = code.replace(/<MarkdownLite content=\{report\[section\] \|\| ''\} \/>/, editorCode.trim());

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched LabResearchAgent.tsx with ManuscriptEditor");
