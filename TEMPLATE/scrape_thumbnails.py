import urllib.request
import re
import json
import os
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def scrape_thumbnails():
    print("Fetching homepage menujuacara.id...")
    req = urllib.request.Request('https://menujuacara.id/', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, context=ctx).read().decode('utf-8')
    
    # Menujuacara.id templates usually are in catalog. We'll search for blocks that have a thumbnail and link
    # Example structure (Elementor): <a href="link"><img src="img_link"...></a>
    
    # We will just find all <a...> <img...> inside and pair them up. Also capture standard names.
    # Actually, a safer way is to find <img ... src="...wp-content/uploads/..."> and if it's inside an anchor, get the href.
    
    # Use simple regex to extract elementor posts or product blocks
    # Looking for a div with class 'elementor-post' or similar, but let's just grab all <a> tags that contain an <img>
    matches = re.finditer(r'<a.*?href=["\'](https://menujuacara\.id/[^"\']+)["\'][^>]*>.*?<img.*?src=["\'](https://menujuacara\.id/wp-content/uploads/[^"\']+(?:jpg|jpeg|png|webp))["\']', html, re.DOTALL | re.IGNORECASE)
    
    results = {}
    
    for m in matches:
        link = m.group(1)
        img = m.group(2)
        
        # Filter for actual template themes
        if 'category' not in link and 'wp-content' not in link and ('tema' in link or 'eksklusif' in link or 'tanpa-foto' in link):
            slug_match = re.search(r'menujuacara\.id/([^/]+)/?', link)
            if slug_match:
                slug = slug_match.group(1).replace('/', '')
                results[slug] = {
                    'url': link,
                    'slug': slug,
                    'thumbnail': img
                }
                
    print(f"Found {len(results)} template thumbnails.")
    
    # Save the JSON metadata
    with open('templates_meta.json', 'w') as f:
        json.dump(list(results.values()), f, indent=4)
        
    print("Saved to templates_meta.json")
    
if __name__ == '__main__':
    scrape_thumbnails()
