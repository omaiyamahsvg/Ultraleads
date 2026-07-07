import os
import re
import asyncio
import random
import smtplib
import imaplib
from datetime import date
from email.message import EmailMessage
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from supabase import create_client, Client
import httpx
from bs4 import BeautifulSoup

app = FastAPI(title="UltraLeads Core Network Architecture")

# Database Integration Anchors
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("CRITICAL ERR: Variable Missing")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Blockchain Network Infrastructure Configuration
DEFAULT_WALLET = "0x3759E7B9987Ab765D4EbFBf58EBf63e7D5664819"
USDT_ERC20_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7"
ETH_RPC_URL = "https://cloudflare-eth.com"

# Network Scraping Variables
PROXY_TUNNEL = "http://127.0.0.1:9090"
EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PHONE_REGEX = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'

# Pydantic Schemas
class PaymentSubmission(BaseModel):
    username: str
    tx_hash: str
    amount: float
    allocated_credits: int

class WalletUpdate(BaseModel):
    admin_email: str
    admin_password_hash: str
    new_wallet_address: str

async def get_active_wallet() -> str:
    try:
        res = supabase.table("system_vault").select(
            "key_value"
        ).eq("key_name", "RECEIVING_WALLET").execute()
        if res.data:
            return res.data[0]["key_value"]
    except Exception:
        pass
    return DEFAULT_WALLET

@app.post("/verify-payment")
async def verify_ethereum_payment(data: PaymentSubmission):
    target_wallet = await get_active_wallet()
    rpc_payload = {
        "jsonrpc": "2.0",
        "method": "eth_getTransactionReceipt",
        "params": [data.tx_hash],
        "id": 1
    }
    async with httpx.AsyncClient() as client:
        try:
            rpc_response = await client.post(
                ETH_RPC_URL, 
                json=rpc_payload, 
                timeout=12.0
            )
            result_data = rpc_response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    if "result" not in result_data or not result_data["result"]:
        raise HTTPException(status_code=400, detail="Hash not found")
    
    receipt = result_data["result"]
    if receipt.get("status") != "0x1":
        raise HTTPException(status_code=400, detail="Tx Reverted")
        
    if str(receipt.get("to")).lower() != USDT_ERC20_CONTRACT.lower():
        raise HTTPException(status_code=400, detail="Not USDT")

    verified_transfer = False
    for log in receipt.get("logs", []):
        topics = log.get("topics", [])
        transfer_sig = (
            "0xddf252ad1be2c89b69c2b068fc378daa952b"
            "a7f163c4a11628f55a4df523b3ef"
        )
        if topics and topics[0] == transfer_sig:
            if len(topics) >= 3:
                dest = "0x" + topics[2][-40:]
                if dest.lower() == target_wallet.lower():
                    verified_transfer = True
                    break

    if not verified_transfer:
        raise HTTPException(status_code=400, detail="Fraud Detected")

    try:
        supabase.table("deposits").insert({
            "username": data.username,
            "amount": data.amount,
            "network_tier": "ERC-20 Ethereum",
            "tx_hash": data.tx_hash,
            "status": "approved",
            "allocated_credits": data.allocated_credits
        }).execute()

        profile_check = supabase.table("user_profiles").select(
            "*"
        ).eq("user_identity", data.username).execute()
        
        if profile_check.data:
            current_credits = profile_check.data[0]["available_credits"]
            supabase.table("user_profiles").update({
                "available_credits": current_credits + data.allocated_credits,
                "updated_at": "now()"
            }).eq("user_identity", data.username).execute()
        else:
            supabase.table("user_profiles").insert({
                "user_identity": data.username,
                "available_credits": data.allocated_credits,
                "offered_free_sample": False
            }).execute()

        return {"status": "success", "msg": "Credits assigned"}
    except Exception as db_err:
        raise HTTPException(status_code=500, detail=str(db_err))
@app.get("/search")
async def smart_intent_search(query: str):
    clean_query = query.strip().lower()
    business_category = clean_query
    
    if clean_query in ["pipes", "leaks", "clogged drain", "plumber"]:
        business_category = "plumbers"
    elif clean_query in ["panels", "clean energy", "solar power", "sun"]:
        business_category = "solar"
    elif clean_query in ["brick", "roofing", "building", "builder"]:
        business_category = "construction"

    result = supabase.table("leads").select(
        "*", count="exact"
    ).eq("business_type", business_category).execute()
    
    return {
        "intent_category": business_category,
        "total_volume": result.count,
        "preview_records": result.data[:15]
    }

@app.post("/admin/update-wallet")
async def update_wallet_address(data: WalletUpdate):
    admin_auth = supabase.table("admin_users").select(
        "*"
    ).eq("email", data.admin_email).eq(
        "password_hash", data.admin_password_hash
    ).eq("role", "main_admin").execute()
    
    if not admin_auth.data:
        raise HTTPException(status_code=403, detail="Denied")
    
    try:
        supabase.table("system_vault").upsert({
            "key_name": "RECEIVING_WALLET",
            "key_value": data.new_wallet_address
        }).execute()
        return {"status": "success", "msg": "Wallet changed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/current-wallet")
async def fetch_current_wallet():
    wallet = await get_active_wallet()
    return {"wallet": wallet}

async def ingestion_scraper_loop():
    await asyncio.sleep(15)
    proxies = {"http://": PROXY_TUNNEL, "https://": PROXY_TUNNEL}
    while True:
        try:
            target_urls = [
                "https://www.yellowpages.com/search?"
                "search_terms=plumbers&geo_location_terms=USA"
            ]
            async with httpx.AsyncClient(
                proxies=proxies, verify=False, timeout=20.0
            ) as client:
                for target in target_urls:
                    response = await client.get(target)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, "html.parser")
                        dom_text = soup.get_text()
                        emails = re.findall(EMAIL_REGEX, dom_text)
                        phones = re.findall(PHONE_REGEX, dom_text)
                        for email, phone in zip(emails, phones):
                            if email and phone:
                                try:
                                    supabase.table("leads").insert({
                                        "name": "Verified Record",
                                        "business_type": "plumbers",
                                        "email": email,
                                        "phone": phone,
                                        "country_tier": "USA",
                                        "state_region": "California",
                                        "status": "new"
                                    }).execute()
                                except Exception:
                                    pass
            await asyncio.sleep(3600)
        except Exception:
            await asyncio.sleep(60)

async def zero_cost_outreach_loop():
    await asyncio.sleep(45)
    while True:
        try:
            smtp_user = os.getenv("SMTP_USER")
            smtp_pass = os.getenv("SMTP_PASS")
            from_mask = os.getenv("MASKED_DOMAIN", "info@elitereader.online")
            if not smtp_user or not smtp_pass:
                await asyncio.sleep(60)
                continue
            try:
                imap = imaplib.IMAP4_SSL("imap.gmail.com")
                imap.login(smtp_user, smtp_pass)
                imap.select("INBOX")
                _, items = imap.search(
                    None, '(FROM "mailer-daemon@googlemail.com")'
                )
                bounce_count = len(items[0].split())
                imap.logout()
                if bounce_count > 45:
                    await asyncio.sleep(86400)
                    continue
            except Exception:
                pass
            l_q = supabase.table("leads").select("*").eq(
                "country_tier", "USA"
            ).eq("status", "new").limit(500).execute()
            target_batch = l_q.data
            if target_batch:
                server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
                server.login(smtp_user, smtp_pass)
                for lead in target_batch:
                    msg = EmailMessage()
                    msg["Subject"] = "Target Acquisition Profile"
                    msg["From"] = from_mask
                    msg["Reply-To"] = from_mask
                    msg["To"] = lead["email"]
                    msg.set_content("Free Sample Allocation...")
                    try:
                        server.send_message(msg)
                        supabase.table("leads").update(
                            {"status": "pitched"}
                        ).eq("id", lead["id"]).execute()
                        supabase.table("outreach_log").insert(
                            {"lead_email": lead["email"]}
                        ).execute()
                    except Exception:
                        pass
                    await asyncio.sleep(random.randint(45, 120))
                server.quit()
            await asyncio.sleep(86400)
        except Exception:
            await asyncio.sleep(300)

@app.on_event("startup")
async def mount_background_threads():
    asyncio.create_task(ingestion_scraper_loop())
    asyncio.create_task(zero_cost_outreach_loop())

@app.get("/", response_class=HTMLResponse)
async def load_client_interface():
    with open("index.html", "r") as index_file:
        return HTMLResponse(content=index_file.read())
