async function run() {
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: "Hello", highThinking: true }) // Uses 'gemini-2.5-pro' now? Wait, what if I pass an invalid model from the client?
  });
  const data = await res.json();
  console.log(data);
}
run();
