import os
import re
import json
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = "https://menujuacara.id/"
target_dir = "/Users/reizarachmattullah/Documents/web invitation/img/thumbnails"
scraped_dir = "/Users/reizarachmattullah/Documents/web invitation/TEMPLATE/Scraped_Templates"

if not os.path.exists(target_dir):
    os.makedirs(target_dir)

templates_data = []

count = 0
for folder in os.listdir(scraped_dir):
    folder_path = os.path.join(scraped_dir, folder)
    if os.path.isdir(folder_path):
        html_files = []
        possible_paths = [
            os.path.join(folder_path, "index.html"),
            os.path.join(folder_path, "menujuacara.id", folder, "index.html"),
            os.path.join(folder_path, "menujuacara.id", "index.html"),
        ]
        
        found_html = None
        for p in possible_paths:
            if os.path.exists(p):
                found_html = p
                break
                
        if not found_html:
            for root, dirs, files in os.walk(folder_path):
                if "index.html" in files:
                    found_html = os.path.join(root, "index.html")
                    break
        
        if found_html:
            with open(found_html, 'r', encoding='utf-8') as f:
                content = f.read()
            
            match = re.search(r'<meta property="og:image"\s+content="([^"]+)"', content)
            
            if not match:
                match = re.search(r'<meta\s+content="([^"]+)"\s+property="og:image"', content)
                
            img_url = None
            if match:
                img_url = match.group(1)
            
            if img_url:
                if img_url.startswith("http"):
                    download_url = img_url
                else:
                    clean_path = img_url.replace("../", "")
                    clean_path = clean_path.replace("wp-content/", "wp-content/") 
                    if clean_path.startswith("/"):
                        clean_path = clean_path[1:]
                    
                    if "wp-content" not in clean_path:
                         # try to find it via heuristic if it's plain relative
                         clean_path = "wp-content/uploads/" + clean_path.split("/")[-1]
                    download_url = base_url + clean_path
                
                ext = "jpg"
                if "png" in download_url.lower(): ext = "png"
                elif "webp" in download_url.lower(): ext = "webp"
                elif "jpeg" in download_url.lower(): ext = "jpg"
                
                file_name = f"{folder}.{ext}"
                target_file = os.path.join(target_dir, file_name)
                
                print(f"Downloading {folder} from {download_url}...")
                try:
                    req = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
                    with urllib.request.urlopen(req, context=ctx) as response:
                        if response.status == 200:
                            data = response.read()
                            with open(target_file, 'wb') as out_file:
                                out_file.write(data)
                            print(f"  -> Success [{file_name}]")
                            count += 1
                            
                            title = folder.replace("-", " ").title()
                            templates_data.append({
                                "id": folder,
                                "name": title,
                                "thumbnail": f"img/thumbnails/{file_name}"
                            })
                        else:
                            print(f"  -> Failed (HTTP {response.status})")
                            
                except Exception as e:
                    print(f"  -> Error: {e}")
            else:
                print(f"[{folder}] No og:image found.")

# Write to json
json_path = '/Users/reizarachmattullah/Documents/web invitation/js/templates.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(templates_data, f, indent=4)
print(f"Finished downloading {count} images. Wrote data mapping to {json_path}")
