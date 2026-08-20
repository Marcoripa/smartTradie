#!/usr/bin/env python3
"""
SmartTradie User Provisioning Script
Creates a new user with PBKDF2-encrypted password in a specific Firestore business subcollection:
Path: /businesses/{business_id}/users/{user_id}
"""

import sys
import os
import argparse
import asyncio
import getpass
import secrets
from datetime import datetime

# Ensure backend package is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.firestore import firestore_service
from app.services.crypto import hash_password

async def insert_user(
    business_id: str,
    name: str,
    email: str,
    password: str,
    role: str = "ADMIN",
    phone: str = "",
    hourly_wage: float = 52.0,
    charge_out_rate: float = 125.0,
    user_id: str = None
):
    clean_biz_id = business_id.strip()
    clean_email = email.strip().lower()
    clean_name = name.strip()
    role = role.strip().upper()
    
    if role not in ["ADMIN", "USER"]:
        print(f"❌ Error: Invalid role '{role}'. Must be either ADMIN or USER.")
        return False

    if not clean_biz_id:
        print("❌ Error: business_id cannot be empty.")
        return False

    if not clean_email or "@" not in clean_email:
        print("❌ Error: A valid email address is required.")
        return False

    if not password:
        print("❌ Error: Password cannot be empty.")
        return False

    print(f"\n🔍 Connecting to Firestore database '{firestore_service.database_id}' in project '{firestore_service.project_id}'...")

    # 1. Check if business exists on Firestore
    biz_doc = await firestore_service.get_document(f"businesses/{clean_biz_id}")
    biz_name = clean_biz_id
    if biz_doc:
        biz_name = biz_doc.get("business_name") or biz_doc.get("name") or clean_biz_id
        print(f"✅ Verified Business: {biz_name} (ID: {clean_biz_id})")
    else:
        print(f"⚠️ Notice: Business document '/businesses/{clean_biz_id}' not found yet. The subcollection will still be created.")

    # 2. Check if a user with this email already exists under this business
    existing_users = await firestore_service.list_collection(f"businesses/{clean_biz_id}/users")
    for u in existing_users:
        if u.get("email", "").strip().lower() == clean_email:
            existing_id = u.get("id") or u.get("_firestore_id")
            print(f"⚠️ User with email '{clean_email}' already exists (User ID: {existing_id}).")
            confirm = input("Do you want to update this user's password and profile? (y/n): ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                return False
            user_id = existing_id
            break

    # 3. Generate user ID if not provided
    if not user_id:
        user_id = f"usr_{secrets.token_hex(4)}"

    # 4. Hash password with PBKDF2-SHA256 (100,000 rounds)
    hashed_password = hash_password(password)

    # 5. Build user record
    now_iso = datetime.now().isoformat()
    user_payload = {
        "id": user_id,
        "name": clean_name,
        "email": clean_email,
        "password_hash": hashed_password,
        "phone": phone.strip(),
        "role": role,
        "business_id": clean_biz_id,
        "business_name": biz_name,
        "hourly_wage": float(hourly_wage),
        "charge_out_rate": float(charge_out_rate),
        "active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    # 6. Save to Firestore
    doc_path = f"businesses/{clean_biz_id}/users/{user_id}"
    success = await firestore_service.save_document(doc_path, user_payload)

    if success:
        print("\n" + "=" * 65)
        print("🎉 USER SUCCESSFULLY INSERTED INTO FIRESTORE!")
        print("=" * 65)
        print(f"👤 Name:          {clean_name}")
        print(f"📧 Email:         {clean_email}")
        print(f"🔑 Password:      •••••••• (Encrypted: {hashed_password[:28]}...)")
        print(f"🛡️ Role:          {role}")
        print(f"🏢 Business ID:   {clean_biz_id} ({biz_name})")
        print(f"🆔 User ID:       {user_id}")
        print(f"📂 Firestore Path: businesses/{clean_biz_id}/users/{user_id}")
        print("=" * 65)
        print(f"\n👉 You can now log into the Dashboard at http://localhost:3000/login using:")
        print(f"   Email:    {clean_email}")
        print(f"   Password: [your entered password]\n")
        return True
    else:
        print("❌ Failed to write user document to Firestore.")
        return False

def main():
    parser = argparse.ArgumentParser(description="Insert a new user into a Firestore business subcollection with PBKDF2 encryption.")
    parser.add_argument("-b", "--business-id", help="Business ID (e.g. 4hYresNm9x4jeTkMWtYy)")
    parser.add_argument("-n", "--name", help="Full Name of the user (e.g. 'Marco Ripa')")
    parser.add_argument("-e", "--email", help="Work email address")
    parser.add_argument("-p", "--password", help="Account password (if omitted, you will be prompted securely)")
    parser.add_argument("-r", "--role", choices=["ADMIN", "USER"], default="ADMIN", help="User role (ADMIN or USER, default: ADMIN)")
    parser.add_argument("--phone", default="", help="Phone number (optional)")
    parser.add_argument("--hourly-wage", type=float, default=52.0, help="Hourly wage cost in AUD (default: 52.0)")
    parser.add_argument("--charge-out-rate", type=float, default=125.0, help="Billable charge-out rate in AUD (default: 125.0)")
    parser.add_argument("--user-id", help="Custom User ID (optional, auto-generated if omitted)")

    args = parser.parse_args()

    # Interactive mode if parameters are missing
    business_id = args.business_id
    if not business_id:
        print("\n🔧 SmartTradie - New User Provisioning")
        print("-" * 45)
        business_id = input("Enter Business ID (e.g. 4hYresNm9x4jeTkMWtYy): ").strip()

    name = args.name
    if not name:
        name = input("Enter Full Name: ").strip()

    email = args.email
    if not email:
        email = input("Enter Work Email: ").strip()

    password = args.password
    if not password:
        password = getpass.getpass("Enter Password for this user: ")
        confirm_pw = getpass.getpass("Confirm Password: ")
        if password != confirm_pw:
            print("❌ Passwords do not match.")
            sys.exit(1)

    role = args.role
    phone = args.phone
    hourly_wage = args.hourly_wage
    charge_out_rate = args.charge_out_rate
    user_id = args.user_id

    asyncio.run(
        insert_user(
            business_id=business_id,
            name=name,
            email=email,
            password=password,
            role=role,
            phone=phone,
            hourly_wage=hourly_wage,
            charge_out_rate=charge_out_rate,
            user_id=user_id
        )
    )

if __name__ == "__main__":
    main()
