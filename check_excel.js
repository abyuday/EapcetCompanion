import XLSX from 'xlsx';

const files = [
  'TGEAPCET_2025_LASTRANKS_FirstPhase.xlsx',
  'TGEAPCET_2025_LASTRANKS_SecondPhase (1).xlsx',
  'TGEAPCET_2025_FINALPHASE_LASTRANKS.xlsx'
];

for (const file of files) {
  console.log(`\n=== File: ${file} ===`);
  try {
    const workbook = XLSX.readFile(file);
    console.log('Sheet Names:', workbook.SheetNames);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('First 3 rows:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  } catch (err) {
    console.error('Error reading file:', err);
  }
}
