import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(
    'https://thesmartschools.edu.pk/',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
html = urllib.request.urlopen(req, context=ctx).read().decode('utf-8', errors='ignore')

imgs = re.findall(r"src='(http[^']+)'", html) + re.findall(r'src="(http[^"]+)"', html)
logos = [i for i in imgs if 'logo' in i.lower()]
print("=== LOGOS ===")
for l in logos:
    print(l)

# Download the first logo
if logos:
    logo_url = logos[0]
    dest = r'c:\Users\abdul\Desktop\The Smart School\frontend\public\tss-logo.png'
    req2 = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req2, context=ctx) as r, open(dest, 'wb') as f:
        f.write(r.read())
    print(f"Downloaded to: {dest}")
else:
    print("No logo found")
