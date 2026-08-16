const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

// I'll extract the attemptGeneration block and rewrite it
const regex = /async function attemptGeneration[\s\S]*?return textResult;\n      \}/;
const match = code.match(regex);

const fixedBlock = `async function attemptGeneration(currentProviderModel, currentIsGroq) {
        let textResult = "";
        if (currentIsGroq && schemaId) {
          let schemaInstruction = "\\n\\nIMPORTANT: You must respond ONLY with raw JSON. Do not use markdown blocks. Return JSON matching this structure:\\n";
          if (schemaId === 'gap-synthesis') {
            schemaInstruction += "{ saturation: string, justification: string, gaps: [{ text: string, provenance: [{uid: string, quote: string}] }] }";
          } else if (schemaId === 'screening-funnel') {
            schemaInstruction += "[{ uid: string, included: boolean, reason: string }]";
          } else if (schemaId === 'literature-reviewer') {
            schemaInstruction += "{ sufficient: boolean, reasoning: string, missingAspects: [string], suggestedExclusionsToReinclude: [string] }";
          } else if (schemaId === 'refinement-pass') {
            schemaInstruction += "[{ issue: string, quote: string, type: 'citation'|'methodology'|'criteria'|'limitation'|'bias'|'other', severity: 'high'|'medium'|'low', section: string }]";
          }
          
          const { text } = await generateText({
            model: currentProviderModel,
            system,
            prompt: prompt + schemaInstruction
          });
          
          textResult = text.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
        } else {
          if (schemaId === 'gap-synthesis') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.object({
                saturation: z.string(),
                justification: z.string(),
                gaps: z.array(z.object({
                  text: z.string(),
                  provenance: z.array(z.object({
                    uid: z.string(),
                    quote: z.string()
                  }))
                }))
              })
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'screening-funnel') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.array(z.object({
                uid: z.string(),
                included: z.boolean(),
                reason: z.string()
              }))
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'literature-reviewer') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.object({
                sufficient: z.boolean(),
                reasoning: z.string(),
                missingAspects: z.array(z.string()).optional(),
                suggestedExclusionsToReinclude: z.array(z.string()).optional()
              })
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'refinement-pass') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.array(z.object({
                issue: z.string(),
                quote: z.string(),
                type: z.enum(['citation', 'methodology', 'criteria', 'limitation', 'bias', 'other']),
                severity: z.enum(['high', 'medium', 'low']),
                section: z.string()
              }))
            });
            textResult = JSON.stringify(object);
          } else {
            const { text } = await generateText({
              model: currentProviderModel,
              system,
              prompt
            });
            textResult = text;
          }
        }
        return textResult;
      }`;

code = code.replace(regex, fixedBlock);
fs.writeFileSync('server.ts', code);
