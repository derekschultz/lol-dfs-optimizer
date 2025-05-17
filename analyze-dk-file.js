// Create a simple utility to directly analyze a DK Entries CSV file
// This will help you determine what format your file is in

const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

/**
 * Analyze a DraftKings entries CSV file and print detailed information
 * @param {string} filePath - Path to the CSV file
 */
async function analyzeDKFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Analyzing DraftKings file: ${filePath}`);
  console.log(`File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB`);
  
  // Read file as text first
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log('\n--- Raw File Preview ---');
  console.log(fileContent.substring(0, 500) + '...');
  
  // Check basic formatting
  const lineCount = fileContent.split('\n').length;
  console.log(`\nLine count: ${lineCount}`);
  
  const commaCount = (fileContent.match(/,/g) || []).length;
  console.log(`Comma count: ${commaCount}`);
  
  // Try to detect CSV dialect
  let dialect = 'standard';
  if (fileContent.includes('\r\n')) {
    dialect = 'CRLF (Windows)';
  } else if (fileContent.includes('\r')) {
    dialect = 'CR (Old Mac)';
  } else {
    dialect = 'LF (Unix/Mac)';
  }
  console.log(`Line ending style: ${dialect}`);
  
  // Check for BOM (Byte Order Mark)
  if (fileContent.charCodeAt(0) === 0xFEFF) {
    console.log('File contains BOM (Byte Order Mark)');
  }
  
  // Detect headers
  console.log('\n--- Trying to detect headers ---');
  const firstLine = fileContent.split('\n')[0];
  console.log('First line:', firstLine);
  
  // Check for common DK format indicators
  if (firstLine.includes('CPT')) {
    console.log('✅ Found CPT position in headers');
  } else {
    console.log('❌ CPT position NOT found in headers');
  }
  
  if (firstLine.includes('FLEX')) {
    console.log('✅ Found FLEX position in headers');
  } else {
    console.log('❌ FLEX position NOT found in headers');
  }
  
  // Try to parse headers with csv-parser
  console.log('\n--- Attempting CSV parsing ---');
  const results = [];
  const headerInfo = { detected: false, headers: [] };
  
  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser({
          skipLines: 0,
          headers: true,
          skipEmptyLines: true,
          trim: true
        }))
        .on('headers', (headers) => {
          headerInfo.detected = true;
          headerInfo.headers = headers;
          console.log('Detected headers:', headers);
        })
        .on('data', (data) => {
          // Store first 2 rows only
          if (results.length < 2) {
            results.push(data);
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
    });
    
    // Print sample data rows
    if (results.length > 0) {
      console.log('\n--- Sample Data Rows ---');
      results.forEach((row, index) => {
        console.log(`Row ${index + 1}:`, row);
      });
      
      // Suggestion for fixing the file
      console.log('\n--- Suggested Fixes ---');
      if (!headerInfo.headers.some(h => h.includes('CPT') || h.includes('FLEX'))) {
        console.log('⚠️ This file does not have standard DraftKings column names.');
        console.log('Suggestions:');
        console.log('1. Check if this is actually a DraftKings entries file');
        console.log('2. Add "CPT" and "FLEX" to the column names if necessary');
        console.log('3. Make sure the file is properly formatted CSV');
      } else {
        console.log('✅ File appears to have valid DraftKings column format');
      }
    } else {
      console.log('❌ No data rows could be parsed');
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
  }
}

// Call with the path to your DK entries file
const filePath = process.argv[2] || path.join(__dirname, 'uploads', 'DKEntries.csv');
analyzeDKFile(filePath).catch(console.error);

// Export for use in other files
module.exports = { analyzeDKFile };
