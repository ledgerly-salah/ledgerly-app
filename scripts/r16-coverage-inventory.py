"""Trace current UI routes to recorded executions; never equate clicks with assertions."""
import json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
app=root/'releases/20261019-readiness-r16/app.3.1.0.js'
s=app.read_text()
logs={str(p.relative_to(root)):set(json.loads(p.read_text())) for p in (root/'validation/r16').glob('browser-*/*actions.json')}
legacy={'enable-security':'Mandatory security setup replaces optional setup.','export-pdf-full':'Report v2 capture handler replaces the legacy menu.','export-pdf-redacted':'Report v2 capture handler replaces the legacy menu.','export-report-full':'Legacy HTML export is not exposed by current report center.','export-report-redacted':'No current rendered control.'}
rows=[]
for kind,values in [('action',re.findall(r"if\(a==='([^']+)'",s)),('form',re.findall(r"form.id==='([^']+)'",s))]:
 for value in values:
  token='submit:'+value if kind=='form' else value
  evidence=[p for p,tokens in logs.items() if token in tokens]
  excluded=legacy.get(value) or ('Legacy optional security form.' if value=='enableSecurityForm' else None)
  rows.append(dict(kind=kind,id=value,status='excluded' if excluded else 'observed' if evidence else 'unobserved',evidence=evidence,note=excluded or 'Execution evidence only; feature assertions are in COVERAGE_REVIEW.md.'))
static=s[s.index('function setupStaticEvents()'):s.index('async function handleDelegatedClick(')]
for value in sorted(set(re.findall(r"\$\('([^']+)'\)\.addEventListener",static))):
 tokens=['#'+value,'submit:'+value]
 evidence=[p for p,items in logs.items() if any(t in items for t in tokens)]
 rows.append(dict(kind='static-control',id=value,status='observed' if evidence else 'needs-context',evidence=evidence,note='Inputs, system events and hidden safe-mode controls require scenario/source mapping; click logs alone are insufficient.'))
context_map={'attachmentFileInput':'Z03/Z07/ZE04','restoreFileInput':'A02/ST03','searchInput':'C06','sortSelect':'Z08','modalBackdrop':'final-acceptance A04; dialog-focus; C07','reloadUpdateBtn':'ST02'}
for row in rows:
 if row['status']=='needs-context' and row['id'] in context_map:
  row['status']='mapped';row['scenario']=context_map[row['id']];row['note']='Mapped to explicit input/event scenario, not inferred from button-click logs.'
result={'build':'20261019-readiness-r16','app_sha256':hashlib.sha256(app.read_bytes()).hexdigest(),'scope':'Chrome and existing shortcut on the user phone; isolated Chromium acceptance; TalkBack excluded by user.','routes':rows,'warning':'This inventory is not statement/branch coverage and does not prove every possible combination.'}
(root/'validation/r16/coverage-inventory.json').write_text(json.dumps(result,indent=2)+'\n')
print({k:sum(r['status']==k for r in rows) for k in ['observed','excluded','unobserved','needs-context','mapped']})
