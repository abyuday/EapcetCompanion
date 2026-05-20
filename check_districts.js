import XLSX from 'xlsx';

const files = [
  { name: 'TGEAPCET_2025_LASTRANKS_FirstPhase.xlsx', sheets: ['First phase '] },
  { name: 'TGEAPCET_2025_LASTRANKS_SecondPhase (1).xlsx', sheets: ['Table 1', 'Table 2'] },
  { name: 'TGEAPCET_2025_FINALPHASE_LASTRANKS.xlsx', sheets: ['Table 1'] }
];

const districtInfo = {};

for (const f of files) {
  const workbook = XLSX.readFile(f.name);
  for (const sheetName of f.sheets) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const hasHeader = !(f.name.includes('SecondPhase') && sheetName === 'Table 2');
    const startRow = hasHeader ? 2 : 0;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 8) continue;
      const distCode = row[3];
      const place = row[2];
      const instCode = row[0];
      
      if (!distCode) continue;
      if (!districtInfo[distCode]) {
        districtInfo[distCode] = { places: new Set(), colleges: new Set() };
      }
      districtInfo[distCode].places.add(place);
      districtInfo[distCode].colleges.add(instCode);
    }
  }
}

console.log('Unique District Codes and Places:');
for (const [code, info] of Object.entries(districtInfo)) {
  console.log(`${code}:`);
  console.log('  Places:', Array.from(info.places).slice(0, 5));
  console.log('  Colleges Count:', info.colleges.size);
}
