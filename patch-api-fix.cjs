const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// remove the duplicated /api/generate
code = code.replace(/  app\.post\("\/api\/generate", async \(req, res\) => \{\n    try \{\n      const \{ prompt \} = req\.body;\n      const providerModel = google\("gemini-3\.1-pro-preview"\);\n      \n      const result = streamText\(\{\n        model: providerModel,\n        prompt: prompt,\n        system: "You are an expert academic writing assistant helping the user draft and refine a medical research manuscript\. Keep additions concise, academic, and directly related to the surrounding text\."\n      \}\);\n      \n      result\.pipeDataStreamToResponse\(res\);\n    \} catch \(e\) \{\n      console\.error\(e\);\n      res\.status\(500\)\.send\(e\.message\);\n    \}\n  \}\);\n/, "");

const streamRoute = `
  app.post("/api/generate-style", async (req, res) => {
    try {
      const { prompt } = req.body;
      const groqKey = process.env.GROQ_API_KEY;
      
      let providerModel;
      if (groqKey) {
        providerModel = groqProvider("llama-3.3-70b-versatile");
      } else {
        providerModel = google("gemini-3.1-pro-preview");
      }
      
      const result = streamText({
        model: providerModel,
        prompt: prompt,
        system: "You are an expert academic writing assistant helping the user draft and refine a medical research manuscript. Keep additions concise, academic, and directly related to the surrounding text. Do not repeat the prompt. Only output the text that should be inserted."
      });
      
      result.pipeDataStreamToResponse(res);
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message);
    }
  });

`;

code = code.replace(/app\.post\("\/api\/verify-doi",/, streamRoute + '  app.post("/api/verify-doi",');

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with /api/generate-style and groq");
