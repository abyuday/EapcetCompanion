import fs from 'fs';

try {
  const content = fs.readFileSync('public/counselling_data.json', 'utf8');
  const data = JSON.parse(content);
  console.log('Extracted Branches:');
  console.log(data.branches);
} catch (err) {
  console.error(err);
}
