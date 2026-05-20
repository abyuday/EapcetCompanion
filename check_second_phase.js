import XLSX from 'xlsx';

const file = 'TGEAPCET_2025_LASTRANKS_SecondPhase (1).xlsx';
try {
  const workbook = XLSX.readFile(file);
  console.log('Sheet Names:', workbook.SheetNames);
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`\nSheet: ${sheetName}`);
    console.log('Headers:', data[1]); // Row index 1 is header
    console.log('Row count:', data.length);
  }
} catch (err) {
  console.error(err);
}
