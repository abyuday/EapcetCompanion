import fs from 'fs';

try {
  const fileContent = fs.readFileSync('public/counselling_data.json', 'utf8');
  const data = JSON.parse(fileContent);
  const college = data.colleges["0"];
  console.log('College name:', college.name);
  const branch = college.branches["CSE"];
  console.log('Branch code:', branch.code);
  console.log('Branch name:', branch.name);
  console.log('Cutoffs structure keys:', Object.keys(branch.cutoffs));
  console.log('Sample cutoff category entries:', Object.entries(branch.cutoffs).slice(0, 3));
} catch (err) {
  console.error('Error:', err);
}
