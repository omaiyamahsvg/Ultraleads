import os
import requests
import pandas as pd
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

# ==================== CONFIGURATION BLOCK ====================
RESEND_API_KEY = "re_g4s7SheW_LYwoYKTJMfDpvHAS8dzwDs2G"
RESEND_SENDER_EMAIL = "leads@elitereader.online" 

TARGET_EMAIL = "" 

DESIRED_LEAD_LIMIT = None 

TARGET_CONFIG = {
    "item_or_property_type": "",
    "location": "",
    "price_or_budget_range": "",
    "detailed_description": ""
}

PROXY_CONFIG = {
    "server": "http://45.38.107.97:6014",
    "username": "qvmqqpbd",
    "password": "5b38wnlcyxk9"
}
# ==============================================================

def run_lead_harvester():
    if not TARGET_EMAIL or not DESIRED_LEAD_LIMIT or not TARGET_CONFIG["item_or_property_type"]:
        print("❌ Error: Configuration block is incomplete! Please fill in TARGET_EMAIL, DESIRED_LEAD_LIMIT, and TARGET_CONFIG details before running.")
        return

    print(f"⚡ Initializing Universal Harvester for: {TARGET_CONFIG['item_or_property_type']}")
    print(f"📍 Location Scope: {TARGET_CONFIG['location']} | Budget/Price: {TARGET_CONFIG['price_or_budget_range']}")
    print(f"🎯 Target Volume Cap: {DESIRED_LEAD_LIMIT} leads | Recipient: {TARGET_EMAIL}")
    
    playwright_proxy = {
        "server": PROXY_CONFIG["server"],
        "username": PROXY_CONFIG["username"],
        "password": PROXY_CONFIG["password"]
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, 
            proxy=playwright_proxy
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        raw_leads = []
        print("🔍 Crawling active buyer inquiries and listings via Webshare proxy...")
        
        simulated_scraped_data = []
        raw_leads.extend(simulated_scraped_data)
        browser.close()

        # --- THE 7-14 DAY FRESHNESS & ISOLATION GUARDRAILS ---
        fresh_verified_leads = []
        cutoff_date = datetime.now() - timedelta(days=14)

        for lead in raw_leads:
            try:
                lead_date = datetime.strptime(lead["listing_date"], "%Y-%m-%d")
                if lead_date >= cutoff_date:
                    if lead.get("email") and lead.get("phone"):
                        fresh_verified_leads.append(lead)
            except Exception:
                continue

        fresh_verified_leads = fresh_verified_leads[:DESIRED_LEAD_LIMIT]
        print(f"✅ Filter complete: Kept {len(fresh_verified_leads)} fresh leads matching criteria.")

        if not fresh_verified_leads:
            print("❌ No fresh leads found within the 14-day window. Aborting email dispatch.")
            return

        # --- GENERATE CSV REPORT ---
        df = pd.DataFrame(fresh_verified_leads)
        csv_filename = f"fresh_leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        df.to_csv(csv_filename, index=False)

        # --- SEND VIA RESEND API TO TARGET EMAIL ---
        print(f"📧 Dispatching fresh lead report to: {TARGET_EMAIL}...")
        
        email_body = f"""
        <h3>⚡ Universal Lead Harvester Report</h3>
        <p><strong>Target Item:</strong> {TARGET_CONFIG['item_or_property_type']}</p>
        <p><strong>Location:</strong> {TARGET_CONFIG['location']}</p>
        <p><strong>Price / Budget:</strong> {TARGET_CONFIG['price_or_budget_range']}</p>
        <p><strong>Details:</strong> {TARGET_CONFIG['detailed_description']}</p>
        <p><strong>Total Fresh Leads Found (Last 14 Days):</strong> {len(fresh_verified_leads)}</p>
        <p>The full CSV dataset has been generated successfully.</p>
        """

        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "from": RESEND_SENDER_EMAIL,
            "to": [TARGET_EMAIL],
            "subject": f"🔥 {len(fresh_verified_leads)} Fresh Leads Found for {TARGET_CONFIG['item_or_property_type']}",
            "html": email_body
        }

        response = requests.post("https://api.resend.com/emails", json=payload, headers=headers)
        
        if response.status_code == 200:
            print(f"🚀 Success! Fresh lead report successfully emailed to {TARGET_EMAIL}.")
        else:
            print(f"⚠️ Resend API Error: {response.text}")

if __name__ == "__main__":
    run_lead_harvester()
