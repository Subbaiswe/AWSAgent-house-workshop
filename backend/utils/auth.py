import base64
import json


def decode_jwt(token: str) -> dict:
    """Decode JWT payload without verification (for logging only)"""
    try:
        payload_part = token.split(".")[1]
        # Add padding if needed
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += "=" * padding
        return json.loads(base64.urlsafe_b64decode(payload_part))
    except Exception:
        return {}


def get_user_id(auth_header: str) -> str:
    """Extract user ID (sub claim) from Authorization header."""
    if auth_header.startswith("Bearer "):
        claims = decode_jwt(auth_header[7:])
        return claims.get("sub", "unknown")
    return "unknown"


