const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const groqReviewerSchema = `} else if (schemaId === 'literature-reviewer') {
            schemaInstruction += "{ sufficient: boolean, reasoning: string, missingAspects: [string], suggestedExclusionsToReinclude: [string] }";
          } else if (schemaId === 'refinement-pass') {`;

code = code.replace(/} else if \(schemaId === 'refinement-pass'\) {/g, groqReviewerSchema);

const zodReviewerSchema = `} else if (schemaId === 'literature-reviewer') {
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
          } else if (schemaId === 'refinement-pass') {`;

code = code.replace(/} else if \(schemaId === 'refinement-pass'\) {/g, zodReviewerSchema);

fs.writeFileSync('server.ts', code);
