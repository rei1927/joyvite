import urllib.request
from bs4 import BeautifulSoup
import json
import re

req = urllib.request.Request('https://menujuacara.id/', headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

soup = BeautifulSoup(html, "html.parser")

mapping = {}

for h2 in soup.find_all("h2"):
    title = h2.get_text(strip=True)
    
    container = h2.find_parent("div", class_=re.compile("e-con-full|elementor-column"))
    if not container: continue
    
    images = container.find_all("img")
    img_url = None
    for img in images:
        src = img.get("src", "")
        if "wp-content/uploads" in src and not src.endswith("svg") and "logo" not in src.lower():
            img_url = src
            break
    if not img_url: continue
    
    links = container.find_all("a")
    matched_slugs = []
    for a in links:
        href = a.get("href", "")
        if "menujuacara.id/" in href:
            slug = href.rstrip("/").split("/")[-1]
            if slug.startswith("tema-") or slug.startswith("eksklusif") or slug.startswith("tasyakuran") or slug.startswith("ultah") or slug.startswith("sweet") or slug.startswith("wedding") or slug.startswith("aqiqah") or slug.startswith("wisuda") or slug.startswith("khitan") or slug.startswith("chinese"):
                matched_slugs.append(slug)
                
    if len(set(matched_slugs)) >= 1 and len(set(matched_slugs)) <= 10: # ensures it's a specific container
        for slug in set(matched_slugs):
            mapping[slug] = {
                "title": title,
                "image": img_url
            }

print(f"Total extracted: {len(mapping)}")
# print a sample
for k in list(mapping.keys())[:5]:
    print(k, mapping[k])
