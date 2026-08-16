const res = `Here are the results:
\`\`\`json
[
  { "uid": "1", "included": true, "reason": "foo" }
]
\`\`\`
Have a good day!`;

let cleaned = res.substring(res.indexOf('['), res.lastIndexOf(']') + 1);
console.log(cleaned);
