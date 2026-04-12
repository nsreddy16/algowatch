#!/usr/bin/env python3
"""
Fetch image URLs from MyDramaList and add them to mydramalist_kdramas_v2.json
Uses cloudscraper to bypass Cloudflare protection
"""
import json
import time
from pathlib import Path

import cloudscraper
from bs4 import BeautifulSoup

project_root = Path(__file__).parent.parent
json_path = project_root / "mydramalist_kdramas_v2.json"

scraper = cloudscraper.create_scraper()

def fetch_image_url(link):
    """Fetch drama image URL from MyDramaList page"""
    try:
        response = scraper.get(link, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Look for the main show image
        img_tag = soup.select_one("img.show-image")
        if img_tag and img_tag.get("src"):
            return img_tag["src"]
        
        # Fallback: og:image meta tag
        meta_tag = soup.select_one('meta[property="og:image"]')
        if meta_tag and meta_tag.get("content"):
            return meta_tag["content"]
        
        return None
    except Exception as e:
        print(f"  Error fetching {link}: {e}")
        return None

def main():
    print(f"Reading {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"Found {len(data)} dramas. Fetching images...")
    
    updated = 0
    failed = 0
    
    for i, drama in enumerate(data):
        # Skip if already has image_url
        if drama.get("image_url"):
            print(f"[{i+1}/{len(data)}] {drama['title']} - already has image")
            continue
        
        if not drama.get("link"):
            print(f"[{i+1}/{len(data)}] {drama['title']} - no link")
            failed += 1
            continue
        
        image_url = fetch_image_url(drama["link"])
        if image_url:
            drama["image_url"] = image_url
            updated += 1
            print(f"[{i+1}/{len(data)}] {drama['title']} - fetched")
        else:
            print(f"[{i+1}/{len(data)}] {drama['title']} - no image found")
            failed += 1
        
        # Rate limit: 0.5 second between requests
        if i < len(data) - 1:
            time.sleep(0.5)
    
    print(f"\nUpdated {updated} dramas with image URLs")
    print(f"Failed to find {failed} images")
    
    # Save back to JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Saved to {json_path}")

if __name__ == "__main__":
    main()
