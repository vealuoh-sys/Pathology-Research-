const { GoogleGenAI } = require('@google/genai');
async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = await ai.models.list();
  const list = [];
  for await (const m of models) {
    list.push(m.name);
  }
  console.log(list.join(', '));
}
run();
