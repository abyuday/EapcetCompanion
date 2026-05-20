import fs from 'fs';

try {
  const html = fs.readFileSync('index.html', 'utf8');
  const lines = html.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('<script')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} catch (err) {
  console.error(err);
}
