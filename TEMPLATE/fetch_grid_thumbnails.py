import urllib.request
from bs4 import BeautifulSoup
import json
import re
import os
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://menujuacara.id/', headers={'User-Agent': 'Mozilla/5.0'})
print("Memuat homepage menujuacara.id...")
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
        # Hindari logo atau ikon
        if "wp-content/uploads" in src and not src.endswith("svg") and "logo" not in src.lower() and "badge" not in src.lower():
            # ambil resolusi tertinggi, biasanya src pada img tag wp memiliki srcset atau kita bisa hapus -768x768.jpg
            img_url = re.sub(r'-\d+x\d+(\.[a-zA-Z]+)$', r'\1', src)
            break
            
    if not img_url: continue
    
    links = container.find_all("a")
    matched_slugs = []
    for a in links:
        href = a.get("href", "")
        if "menujuacara.id/" in href:
            slug = href.rstrip("/").split("/")[-1]
            if slug.startswith("tema-") or slug.startswith("eksklusif") or slug.startswith("tasyakuran") or slug.startswith("ultah") or slug.startswith("sweet") or slug.startswith("wedding") or slug.startswith("aqiqah") or slug.startswith("wisuda") or slug.startswith("khitan") or slug.startswith("chinese") or slug.startswith("tasyakuran"):
                matched_slugs.append(slug)
                
    if 1 <= len(set(matched_slugs)) <= 10:
        for slug in set(matched_slugs):
            mapping[slug] = {
                "title": title,
                "image": img_url
            }

print(f"Berhasil memetakan {len(mapping)} tema dari homepage.")

json_path = '/Users/reizarachmattullah/Documents/web invitation/js/templates.json'
with open(json_path, 'r', encoding='utf-8') as f:
    local_templates = json.load(f)

target_dir = "/Users/reizarachmattullah/Documents/web invitation/img/thumbnails"

updated_count = 0
for template in local_templates:
    slug = template['id']
    if slug in mapping:
        map_data = mapping[slug]
        img_url = map_data["image"]
        title = map_data["title"]
        
        # update title
        template["name"] = title
        
        # setup fresh extension
        ext = img_url.split(".")[-1].lower()
        if ext not in ["png", "jpg", "jpeg", "webp"]: ext = "jpg"
        
        file_name = f"{slug}-grid.{ext}"
        target_file = os.path.join(target_dir, file_name)
        
        try:
            req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_img, context=ctx) as response:
                if response.status == 200:
                    with open(target_file, 'wb') as out_file:
                        out_file.write(response.read())
                    template["thumbnail"] = f"img/thumbnails/{file_name}"
                    updated_count += 1
                    print(f" OK -> {slug} [{title}] | {file_name}")
                else:
                    print(f" GAGAL (HTTP {response.status}) -> {img_url}")
        except Exception as e:
            print(f" ERROR -> {slug}: {e}")

# Save updated JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(local_templates, f, indent=4)

print(f"Selesai! {updated_count} thumbnail grid diperbarui.")
