import os,subprocess,json,time
from pathlib import Path
names=['browser-current-acceptance', 'browser-az-acceptance', 'browser-az-edge', 'browser-static-coverage', 'browser-r13-accessibility', 'browser-r14-scroll', 'browser-r15-home', 'browser-r11-offline-evidence', 'browser-r12-scale']
env=dict(os.environ)
# Optional local runner overrides; CI may use its installed browser and module.
for key,path in {'LEDGERLY_AXE_PATH':'/workspace/scratch/5294820a0401/browser-tools/node_modules/axe-core/axe.min.js','LEDGERLY_PLAYWRIGHT_MODULE':'/workspace/scratch/5294820a0401/browser-tools/node_modules/playwright/index.mjs','LEDGERLY_CHROMIUM_PATH':'/tmp/chromium'}.items():
 if key not in env and Path(path).exists():env[key]=path

results=[]
for name in names:
 Path('validation/r16/'+name).mkdir(parents=True,exist_ok=True)
 start=time.time()
 with open('validation/r16/'+name+'/run.txt','w') as out:
  try:r=subprocess.run(['node','scripts/r16-'+name+'.mjs'],env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180);code=r.returncode
  except subprocess.TimeoutExpired:code=124
 results.append(dict(suite=name,exit=code,seconds=round(time.time()-start,2)))
 print(results[-1],flush=True)
 Path('validation/r16/browser-runs.json').write_text(json.dumps(results,indent=2))

raise SystemExit(1 if any(x["exit"] for x in results) else 0)
