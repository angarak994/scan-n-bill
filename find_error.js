const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src');
for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
        file,
        code,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const diagnostics = sourceFile.parseDiagnostics;
    if (diagnostics.length > 0) {
        console.log(`--- Errors in ${file} ---`);
        diagnostics.forEach(d => {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
            const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            console.log(`Error at line ${line + 1}, col ${character + 1}: ${message}`);
        });
    }
}
