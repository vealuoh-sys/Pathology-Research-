const fs = require('fs');
let code = fs.readFileSync('src/ManuscriptEditor.tsx', 'utf-8');

code = code.replace(
  /let html = marked.parse\(initialContent\) as string;\n    flags.forEach\(\(f: any\) => \{\n      if \(f.quote\) \{\n        const highlighted = `<mark data-color="#ef4444" style="background-color: rgba\\(239, 68, 68, 0.2\\); color: #ef4444; border-radius: 4px; padding: 0 4px;">\\$\\{f.quote\\}<\/mark>`;\n        html = html.replace\(f.quote, highlighted\);\n      \}\n    \}\);/g,
  `let textWithHighlights = initialContent || '';
    flags.forEach((f: any) => {
      if (f.quote) {
        const highlighted = \\\`<mark data-color="#ef4444" style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 4px; padding: 0 4px;">\${f.quote}</mark>\\\`;
        textWithHighlights = textWithHighlights.replace(f.quote, highlighted);
      }
    });
    const html = marked.parse(textWithHighlights) as string;`
);

fs.writeFileSync('src/ManuscriptEditor.tsx', code);
console.log("Patched marked parsing order");
