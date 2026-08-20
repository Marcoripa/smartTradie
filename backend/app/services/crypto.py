import hashlib
import os
import secrets

ITERATIONS = 100000
HASH_NAME = 'sha256'

def hash_password(password: str) -> str:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and random 16-byte salt.
    Returns: pbkdf2_sha256$<iterations>$<hexSalt>$<hexHash>
    """
    salt_bytes = secrets.token_bytes(16)
    hex_salt = salt_bytes.hex()
    dk = hashlib.pbkdf2_hmac(HASH_NAME, password.encode('utf-8'), salt_bytes, ITERATIONS)
    hex_hash = dk.hex()
    return f"pbkdf2_sha256${ITERATIONS}${hex_salt}${hex_hash}"

def verify_password(password: str, stored_hash_or_plain: str) -> bool:
    """
    Verify a password against a stored PBKDF2 hash or legacy string.
    """
    if not password or not stored_hash_or_plain:
        return False
        
    if stored_hash_or_plain.startswith("pbkdf2_sha256$"):
        try:
            parts = stored_hash_or_plain.split("$")
            if len(parts) != 4:
                return False
            iterations = int(parts[1])
            salt_bytes = bytes.fromhex(parts[2])
            expected_hash = parts[3]
            
            dk = hashlib.pbkdf2_hmac(HASH_NAME, password.encode('utf-8'), salt_bytes, iterations)
            actual_hash = dk.hex()
            return secrets.compare_digest(actual_hash, expected_hash)
        except Exception:
            return False
            
    # Legacy plaintext check
    return secrets.compare_digest(password, stored_hash_or_plain)
