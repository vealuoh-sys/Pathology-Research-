function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const entries = Object.entries(invertedIndex);
  let maxIndex = 0;
  for (const [word, positions] of entries) {
    for (const pos of positions) {
      if (pos > maxIndex) maxIndex = pos;
    }
  }
  const words = new Array(maxIndex + 1).fill('');
  for (const [word, positions] of entries) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').replace(/\s+/g, ' ').trim();
}
fetch('https://api.openalex.org/works/W2741809807')
  .then(r => r.json())
  .then(data => console.log(reconstructAbstract(data.abstract_inverted_index)));
