const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `        try {
          let res = await callGemini(prompt, { webSearch: false, highThinking: false, schemaId: 'screening-funnel' });
          res = res.replace(/^\\\`\\\`\\\`(json)?/m, '').replace(/\\\`\\\`\\\`$/m, '').trim();
          const parsed = JSON.parse(res);
          if (Array.isArray(parsed)) {
            allParsed = allParsed.concat(parsed);
          }
        } catch (err) {
          console.warn("Failed to screen batch", i, err);
        }`;

const replacement = `        try {
          let res = await callGemini(prompt, { webSearch: false, highThinking: false, schemaId: 'screening-funnel' });
          try {
            // Robust JSON extraction
            const jsonStart = res.indexOf('[');
            const jsonEnd = res.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              res = res.substring(jsonStart, jsonEnd + 1);
            }
            const parsed = JSON.parse(res);
            if (Array.isArray(parsed)) {
              allParsed = allParsed.concat(parsed);
            }
          } catch (parseErr) {
            console.error("Failed to parse JSON for batch", i, "\\nRaw Res:", res, "\\nErr:", parseErr);
          }
        } catch (err) {
          console.error("Failed to screen batch (API Error)", i, err);
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched json parsing in screener");
