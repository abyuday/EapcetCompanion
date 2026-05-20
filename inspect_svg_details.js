import fs from 'fs';
const content = fs.readFileSync('public/telangana_districts.svg', 'utf8');

// Use regex to find all <path ... /> elements
const pathRegex = /<path([^>]+)\/?>/g;
let match;
let index = 0;
console.log("Path details:");
while ((match = pathRegex.exec(content)) !== null) {
  const body = match[1];
  const id = (body.match(/id="([^"]+)"/) || [])[1];
  const name = (body.match(/name="([^"]+)"/) || [])[1];
  const className = (body.match(/class="([^"]+)"/) || [])[1];
  console.log(`Path ${index++}: id=${id}, name=${name}, class=${className}`);
}
