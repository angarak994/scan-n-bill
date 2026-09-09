const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');
const sourceFile = ts.createSourceFile(
    'page.tsx',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
);

const diagnostics = sourceFile.parseDiagnostics;
if (diagnostics.length > 0) {
    diagnostics.forEach(d => {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
        const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        console.log(`Error at line ${line + 1}, col ${character + 1}: ${message}`);
    });
} else {
    console.log("No syntax errors found!");
}
