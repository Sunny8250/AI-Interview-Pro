const fs = require('fs');

let raw = fs.readFileSync('eslint-report.json');
let text = raw.toString('utf16le');
if (text.charCodeAt(0) === 0xFEFF) {
  text = text.slice(1);
}
const report = JSON.parse(text);

report.forEach(file => {
  if (file.errorCount === 0 && file.warningCount === 0) return;
  
  let content = fs.readFileSync(file.filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  // sort messages by line and column descending so that changes at the end of a line 
  // don't shift the columns for earlier changes on the same line
  const messages = file.messages
    .filter(m => m.ruleId === 'unused-imports/no-unused-vars' || m.ruleId === 'unused-imports/no-unused-imports')
    .sort((a, b) => b.line !== a.line ? b.line - a.line : b.column - a.column);

  for (const m of messages) {
    console.log(`Fixing ${m.ruleId} in ${file.filePath}:${m.line}`);
    
    // The message is typically: "'varName' is assigned a value but never used."
    const match = m.message.match(/'([^']+)'/);
    if (!match) continue;
    const varName = match[1];

    if (m.ruleId === 'unused-imports/no-unused-vars') {
        const lineIdx = m.line - 1;
        const line = lines[lineIdx];
        
        // Find the variable in the line and prefix it with _
        // We look for varName as a whole word
        const regex = new RegExp(`\\b${varName}\\b`);
        
        // Let's just prefix with _
        if (regex.test(line)) {
            lines[lineIdx] = line.replace(regex, `_${varName}`);
            modified = true;
        }
    }
  }

  if (modified) {
    fs.writeFileSync(file.filePath, lines.join('\n'));
    console.log(`Updated ${file.filePath}`);
  }
});

console.log('Done fixing unused variables.');
