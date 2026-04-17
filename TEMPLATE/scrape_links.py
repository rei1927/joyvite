import urllib.request
import re

def find_premium_links():
    print("Fetching homepage...")
    req = urllib.request.Request('https://menujuacara.id/', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    
    links = re.findall(r'href=[\'\"](https://menujuacara\.id/[^\'\"]+)[\'\"]', html)
    all_links = set([l for l in links if 'wp-content' not in l and 'category' not in l])
            
    template_links = set()
    for l in all_links:
        if re.search(r'tema-\d+-|eksklusif.*foto|tanpa-foto', l, re.IGNORECASE):
            template_links.add(l)
    
    print(f"Found {len(template_links)} potential template links.")
    for l in sorted(template_links):
        print(l)

if __name__ == '__main__':
    find_premium_links()
