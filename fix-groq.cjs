const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

// Add isGroq tracking
code = code.replace(/let providerModel;/, 'let providerModel;\n      let isGroq = false;');
code = code.replace(/providerModel = groqProvider\("llama-3.3-70b-versatile"\);/, 'providerModel = groqProvider("llama-3.3-70b-versatile");\n        isGroq = true;');

// Rewrite the schema handling to bypass generateObject for Groq
const newSchemaLogic = `
      let responseText = "";
      
      if (isGroq && schemaId) {
        let schemaInstruction = "\\n\\nIMPORTANT: You must respond ONLY with raw JSON. Do not use markdown blocks. Return JSON matching this structure:\\n";
        if (schemaId === 'gap-synthesis') {
          schemaInstruction += "{ saturation: string, justification: string, gaps: [{ text: string, provenance: [{uid: string, quote: string}] }] }";
        } else if (schemaId === 'screening-funnel') {
          schemaInstruction += "[{ uid: string, included: boolean, reason: string }]";
        } else if (schemaId === 'refinement-pass') {
          schemaInstruction += "[{ issue: string, quote: string, type: 'citation'|'methodology'|'criteria'|'limitation'|'bias'|'other', severity: 'high'|'medium'|'low', section: string }]";
        }
        
        const { text } = await generateText({
          model: providerModel,
          system,
          prompt: prompt + schemaInstruction
        });
        
        responseText = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      } else {
        // Use generateObject for specific schemas to enforce Zod constraints
        if (schemaId === 'gap-synthesis') {
          const { object } = await generateObject({
            model: providerModel,
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
          responseText = JSON.stringify(object);
        } else if (schemaId === 'screening-funnel') {
          const { object } = await generateObject({
            model: providerModel,
            system,
            prompt,
            schema: z.array(z.object({
              uid: z.string(),
              included: z.boolean(),
              reason: z.string()
            }))
          });
          responseText = JSON.stringify(object);
        } else if (schemaId === 'refinement-pass') {
          const { object } = await generateObject({
            model: providerModel,
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
          responseText = JSON.stringify(object);
        } else {
          // Standard text generation
          const { text } = await generateText({
            model: providerModel,
            system,
            prompt
          });
          responseText = text;
        }
      }
`;

// We need to replace the entire schema logic block.
const oldSchemaLogicRegex = /let responseText = "";[\s\S]*?responseText = text;\n      \}/;
code = code.replace(oldSchemaLogicRegex, newSchemaLogic.trim());

fs.writeFileSync('server.ts', code);
