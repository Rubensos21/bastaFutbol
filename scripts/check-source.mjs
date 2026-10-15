import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc';
import ts from 'typescript';
let errors = 0,
  components = 0,
  typescriptFiles = 0;
function scan(directory) {
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory()) {
      if (!['node_modules', 'dist', 'generated'].includes(file.name)) scan(path);
    } else if (path.endsWith('.vue')) {
      components++;
      const source = readFileSync(path, 'utf8');
      const result = parse(source, { filename: path });
      for (const error of result.errors) {
        console.error(path, error);
        errors++;
      }
      try {
        const script =
          result.descriptor.script || result.descriptor.scriptSetup
            ? compileScript(result.descriptor, { id: path })
            : { bindings: {} };
        const template = compileTemplate({
          id: path,
          source: result.descriptor.template?.content ?? '',
          filename: path,
          compilerOptions: { bindingMetadata: script.bindings },
        });
        for (const error of template.errors) {
          console.error(path, error);
          errors++;
        }
      } catch (e) {
        console.error(path, e.message);
        errors++;
      }
    } else if (path.endsWith('.ts')) {
      typescriptFiles++;
      const output = ts.transpileModule(readFileSync(path, 'utf8'), {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: {
          experimentalDecorators: true,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      });
      for (const diagnostic of output.diagnostics ?? []) {
        console.error(path, ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
        errors++;
      }
    }
  }
}
for (const directory of ['apps', 'packages', 'tests']) scan(directory);
console.log(
  `${components} componentes Vue y ${typescriptFiles} archivos TypeScript analizados; ${errors} errores de sintaxis.`,
);
process.exitCode = errors ? 1 : 0;
