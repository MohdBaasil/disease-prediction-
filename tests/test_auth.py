import unittest
from datetime import timedelta
from jose import jwt

# Adjust python path if needed (or run from root)
from backend.services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM
)

class TestAuthService(unittest.TestCase):
    
    def test_password_hashing(self):
        password = "mysecretpassword123"
        hashed = get_password_hash(password)
        
        # Verify hash is different from original
        self.assertNotEqual(password, hashed)
        
        # Verify verification works
        self.assertTrue(verify_password(password, hashed))
        
        # Verify invalid password fails
        self.assertFalse(verify_password("wrongpassword", hashed))

    def test_create_access_token(self):
        data = {"sub": "johndoe", "role": "Patient"}
        expires = timedelta(minutes=15)
        
        token = create_access_token(data, expires_delta=expires)
        
        # Decode and verify payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        self.assertEqual(payload.get("sub"), "johndoe")
        self.assertEqual(payload.get("role"), "Patient")
        self.assertIn("exp", payload)

if __name__ == "__main__":
    unittest.main()
