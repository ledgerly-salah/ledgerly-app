"""Conservative raster-background contrast probe; does not replace manual WCAG review."""
from pathlib import Path
import json,re,os
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/os.environ.get('LEDGERLY_CONTRAST_OUTPUT','validation/r12/contrast-pixels')
rows=json.loads((root/'samples.json').read_text())
def luminance(a):
 a=a/255.;a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
 return a@np.array([.2126,.7152,.0722])
icons=['#privacyBtn','#themeBtn','#settingsBtn','.next-icon','.search > span','button[data-action="toggle-creditor"]']
for r in rows:
 original=np.asarray(Image.open(root/(r['name']+'-original.png')).convert('RGB')).astype(float)
 bg=np.asarray(Image.open(root/(r['name']+'-background.png')).convert('RGB')).astype(float)
 if original.shape!=bg.shape:r['status']='capture-size-mismatch';continue
 mask=np.max(np.abs(original-bg),axis=2)>15
 r['sampledPixels']=int(mask.sum())
 if not mask.any():r['status']='no-glyph-pixels';continue
 background=bg[mask];numbers=[float(x) for x in re.findall(r'[\d.]+',r['color'])];alpha=(numbers[3] if len(numbers)>3 else 1)*r['opacity'];fg=np.array(numbers[:3])*alpha+background*(1-alpha)
 fl=luminance(fg);bl=luminance(background);ratios=(np.maximum(fl,bl)+.05)/(np.minimum(fl,bl)+.05)
 symbol=r['selector'] in icons or (r['selector'].startswith('a[href') and r['selector'].endswith('> span'))
 size=float(r['fontSize'].replace('px',''));weight=float(r['fontWeight']);r['threshold']=3 if symbol or size>=24 or (size>=18.6667 and weight>=700) else 4.5
 r['minRatio']=round(float(ratios.min()),3)
 r['status']='decorative-separator' if r['selector']=='.sep' else 'meets-sampled-threshold' if r['minRatio']>=r['threshold'] else 'review-required'
(root/'analysis.json').write_text(json.dumps(rows,indent=2))
from collections import Counter
print(Counter(r['status'] for r in rows))
for r in rows:
 if r['status'] not in ['meets-sampled-threshold','decorative-separator']:print(r['name'],r['selector'],r.get('minRatio'),r.get('threshold'),r['status'])
