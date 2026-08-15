const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

// Replace the imports and the /api/generate endpoint
// First, add the imports at the top
serverCode = `import { z } from "zod";
import { generateText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { groq as groqProvider } from "@ai-sdk/groq";
import { GoogleGenAI } from "@google/genai";
` + serverCode;

// Remove the inline dynamic import of @google/genai inside /api/generate
serverCode = serverCode.replace(
  /const \{ GoogleGenAI, ThinkingLevel \} = await import\("@google\/genai"\);/,
  "// Removed dynamic import"
);

// We need to rewrite the /api/generate block completely.
// Let's use a regex to replace it
const generateRegex = /app\.post\("\/api\/generate", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: error\.message \}\);\n    \}\n  \}\);/;

const newGenerateEndpoint = `app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, system, webSearch, highThinking, schemaId } = req.body;
      const geminiKey = process.env.GEMINI_API_KEY;
      const groqKey = process.env.GROQ_API_KEY;
      
      let providerModel;
      
      // Select Provider and Model
      if (geminiKey && (webSearch || highThinking || !groqKey)) {
        let modelName = "gemini-2.5-flash"; // Fixed to valid models
        
        if (webSearch) {
          modelName = "gemini-2.5-flash"; // Vercel AI SDK Google provider handles search via tools, but for this app just use a valid model.
        } else if (highThinking) {
          modelName = "gemini-2.5-pro"; // Use 2.5 pro for "high thinking"
        }
        
        // Validate against SDK's supported models
        const googleGenAI = new GoogleGenAI({ apiKey: geminiKey });
        const models = await googleGenAI.models.list();
        const supportedModels = [];
        for await (const m of models) {
          supportedModels.push(m.name.replace('models/', ''));
        }
        
        if (!supportedModels.includes(modelName)) {
          throw new Error(\`Invalid model name requested: \${modelName}. Supported models include: \${supportedModels.slice(0, 5).join(', ')}...\`);
        }
        
        console.log(\`Trying Gemini API (\${modelName})...\`);
        providerModel = google(modelName);
      } else {
        if (!groqKey) {
          throw new Error("GROQ_API_KEY environment variable is required if Gemini is not configured.");
        }
        console.log("Processing request with GROQ_API_KEY ending in:", groqKey.slice(-4));
        providerModel = groqProvider("llama-3.3-70b-versatile");
      }
      
      let responseText = "";
      
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
      
      return res.json({ text: responseText });
    } catch (error: any) {
      console.error("API Error (Properly surfaced):", error.message || error);
      res.status(500).json({ error: error.message || "Provider call failed" });
    }
  });`;

serverCode = serverCode.replace(generateRegex, newGenerateEndpoint);
fs.writeFileSync('server.ts', serverCode);
