const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

if (!code.includes('streamText')) {
  code = code.replace(/import \{ generateText, generateObject \} from "ai";/, 'import { generateText, generateObject, streamText } from "ai";');
}

const completionEndpoint = `
  app.post("/api/completion", async (req, res) => {
    try {
      const { prompt } = req.body;
      const providerModel = google("gemini-3.1-pro-preview");
      
      const result = streamText({
        model: providerModel,
        prompt: prompt,
        system: "You are an expert academic writing assistant helping the user draft and refine a medical research manuscript. Keep additions concise, academic, and directly related to the surrounding text."
      });
      
      result.pipeDataStreamToResponse(res);
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message);
    }
  });

  app.post("/api/verify-doi",`;

code = code.replace(/app\.post\("\/api\/verify-doi",/, completionEndpoint);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with /api/completion");
