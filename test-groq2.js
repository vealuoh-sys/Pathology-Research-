import { z } from "zod";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const { object } = await generateObject({
      model: groq("llama3-8b-8192"),
      schema: z.object({ test: z.string() }),
      prompt: "say hi",
    });
    console.log("llama3-8b-8192 auto mode success:", object);
  } catch(e) {
    console.error("llama3-8b-8192 auto mode failed:", e.message);
  }
}
run();
