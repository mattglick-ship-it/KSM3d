// Node-only tooling bridge. Never imported by browser code.
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=function(module,path){const s=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;module._compile(s,path)};
