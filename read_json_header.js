import fs from 'fs';

try {
  const fileContent = fs.readFileSync('public/counselling_data.json', 'utf8');
  const data = JSON.parse(fileContent);
  console.log('JSON Keys:', Object.keys(data));
  if (data.branches) {
    console.log('Branches count:', Object.keys(data.branches).length);
    console.log('Sample branches:', Object.entries(data.branches).slice(0, 3));
  }
  if (data.colleges) {
    console.log('Colleges count:', Object.keys(data.colleges).length);
    const firstCollegeKey = Object.keys(data.colleges)[0];
    console.log('Sample college:', firstCollegeKey, data.colleges[firstCollegeKey]);
  }
  if (data.cutoffTrends) {
    console.log('Cutoff trends count:', data.cutoffTrends.length);
    console.log('Sample cutoff trend:', data.cutoffTrends.slice(0, 2));
  }
} catch (err) {
  console.error('Error reading JSON:', err);
}
