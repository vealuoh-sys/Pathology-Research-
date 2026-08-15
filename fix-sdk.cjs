const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/import \{ google \} from "@ai-sdk\/google";/, 'import { createGoogleGenerativeAI } from "@ai-sdk/google";');
code = code.replace(/providerModel = google\(modelName\);/, 'const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });\n        providerModel = googleProvider(modelName);');

fs.writeFileSync('server.ts', code);
