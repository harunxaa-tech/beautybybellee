import base64
import json
import unittest
from secret_scan import findings,scan_blob
def jwt(role):
    enc=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
    return enc({"alg":"HS256","typ":"JWT"})+"."+enc({"role":role})+"."+"A"*32
class SecretScanTest(unittest.TestCase):
    def test_admin_jwt(self): self.assertIn("Supabase service-role JWT",findings(jwt("service_role")))
    def test_public_jwt(self): self.assertEqual(findings(jwt("anon")),set())
    def test_stripe(self): self.assertIn("Stripe secret",findings("sk_"+"live_"+"a"*30))
    def test_openai(self): self.assertIn("OpenAI secret",findings("sk-"+"proj-"+"a"*40))
    def test_names_not_credentials(self): self.assertEqual(findings("SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY OPENAI_API_KEY"),set())
    def test_no_secret_in_report(self):
        key="whsec_"+"a"*40
        result=scan_blob(key.encode(),"source.js")
        self.assertEqual(result,[("source.js","Stripe webhook secret")])
        self.assertNotIn(key,str(result))
if __name__=="__main__": unittest.main()
