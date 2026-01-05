# 🚀 Netlify Deployment Guide

## Issue: Environment Variables Exceed 4KB Limit

AWS Lambda (used by Netlify Functions) has a 4KB limit for environment variables. The `VERTEX_AI_SERVICE_ACCOUNT_KEY` JSON is too large.

## ✅ Solution: Use Individual Credential Fields

Instead of storing the entire JSON, store only the required fields.

---

## 📝 Netlify Environment Variables Setup

Go to your Netlify dashboard → **Site settings** → **Environment variables** → **Add a variable**

Add these **4 variables**:

### 1. VERTEX_AI_PROJECT_ID
```
laxy-guide
```

### 2. VERTEX_AI_LOCATION
```
us-central1
```

### 3. VERTEX_AI_CLIENT_EMAIL
```
vertex-ai-guide-generator@laxy-guide.iam.gserviceaccount.com
```

### 4. VERTEX_AI_PRIVATE_KEY
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDsa0sWwD0edtWc
0Z+B/qQTRsGiERCjC0+Qqn8hO+YkjpOjxv26AA+05AwpETfJmSibIzGCZD1WpXia
trjnWButA1YIVOgA72Y5DRm3D0Xepic+OU8iuAVNKEM9OZoYlz5+eCQtVGoR02BI
V+nMn2g5kgRZw74sQpzwreF68qo6Ec0dZhPIWFLyKyYGTXfqbDtdRroz2R/FRaZj
8SDz3rqSuTraETQsCQ0N6wMt3t8XExb7De/EK6265zLhlimGkHkn5zl0UfaI9z8Q
k/xhk9irbwRZqYQXSFI0zPaXYwBGUD//km4PemgWjAinDA6dZTjxGsyLUSsCOTct
nRtrvvyVAgMBAAECggEATgdDayjbgzh5XB6bZI4knPAXbGPxd7597iM3fkKEvMAJ
3l4I0+C9TliN4uf536GbE0jUSFLJI9XNLlLsR/5+c+XL+Uf8ooJg3KeEOzThPJDe
Ft1XTwApT8PgHU7rmv4f9CG23vcjYuq+tmG9mnlqLsYQhYfjNjxuC8l3x9pbcHpZ
MItxdT9Oh/YhZWeS3M+5FzAwkVuCjjdZDpT/fAGBAMSCvzeTUYxEDpkYuC5RGZzx
a40TJ/kGyF3xSGaTpHkzJC9OwZP8pOV4DDwryqLe+nPp3CL2JeKzABolLN+mEY6q
RK0o0Wg1+8lFUY95+9kQahF5HHnzx9x2xu4BtAn/qQKBgQD3xGUbqGRQj6dNNqSe
J5nUbv5+HD7RmR8b6gTnoFiQzlqFnz0BCMnksKvDy4P2cEWHloNiLVEE8o+k9r8A
00aWmXDej8umXJ4mts9TcJvu4BPW+rWs1XS6LXfOQwebp3OCm2pexJEiRqiesNec
IE6Rjhlh6QWJqGwTdIx+gmvAfwKBgQD0Rl4K+3elOaCvgtYVGWcgheDwKVreWs6Q
p7mjemE/lp64Ny4GMnjTEWpuZyv0Unaa3gOY6kqpJRNi82Ml0uETOyK9EZvZ2yHQ
BB/jETlSAFg29P3+BRnQkZqj1PNrbGk6bae/BKTfCIqcj2SfbIGqo9FNr2V/29iQ
o7prgoa46wKBgQCQKxECFOu6DLy2qxMCi9xwxd0DmH/dChIV9gfAl4axS8FUeyHO
FkUT8tEfbq5smUt759KvL9sy28lFneXqHwW137bTaix/sui7cigVTzMMvgoNT3ij
BtmS854AwPQOWFNYLgKo/gvNO/wlypTK3emZvGt8k1CLlxq7/1c4zb7RFQKBgDb1
cgk0hLnG2nFClZoPqhU2KeK+2zP16E3BftHaIfElmTZHK/K2/lo2q+SFD+2bdBXp
55NK+1tM/SyhJ+iFpqAmCO3S/Wapl9TuaKI06NmbPD25J0A0s5cqe0lrCw1bSd2c
eEZQ7CtGB7GrzW7VAeN7kgbRdJuswe/g9ntj1Z3bAoGAIJPrlQdrUV+0pUl2Sy1B
gAXcwB0Wtjn2s1hD/EFozsll7S7XPpyg2XDpy59lpbQ1P6hQGiRLJbxaOi+YR2x4
mO58ZOB5gG51JYngJ0M0rOTcCVr/vH4GCLTTE60K9bkGjWfQJaaA+5wUB+4+yaqH
eAccltMpNycOkZOm4r/+ERE=
-----END PRIVATE KEY-----
```

**⚠️ Important Notes:**
- Copy the **entire private key** including the BEGIN and END lines
- Preserve all newlines exactly as shown
- Don't add quotes or escape characters

---

## 🔧 For Existing Variables

If you already have `VERTEX_AI_SERVICE_ACCOUNT_KEY` in Netlify:
1. **Delete it** (it's too large)
2. Add the 4 individual variables above instead

---

## ✅ Local Development

Your `.env` file can keep using the full JSON for convenience:
```env
VERTEX_AI_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

The updated function code supports **both approaches**:
- **Local dev**: Uses `VERTEX_AI_SERVICE_ACCOUNT_KEY` (full JSON)
- **Netlify**: Uses individual fields (`VERTEX_AI_CLIENT_EMAIL` + `VERTEX_AI_PRIVATE_KEY`)

---

## 🧪 Testing After Deployment

1. Deploy to Netlify with the new environment variables
2. Open your deployed site's guide generator
3. Upload a PDF
4. Check if AI generation works

If you see errors, check:
- All 4 variables are set correctly
- Private key includes BEGIN/END lines
- No extra spaces or quotes

---

## 📊 Environment Variables Summary

| Variable | Size | Used For |
|----------|------|----------|
| `VERTEX_AI_PROJECT_ID` | ~10 bytes | Project identifier |
| `VERTEX_AI_LOCATION` | ~11 bytes | Region |
| `VERTEX_AI_CLIENT_EMAIL` | ~60 bytes | Service account email |
| `VERTEX_AI_PRIVATE_KEY` | ~1.6 KB | Authentication |
| **Total** | **~1.7 KB** | **✅ Under 4KB limit** |

---

## 🚀 Ready to Deploy!

After setting the environment variables:

```bash
git add .
git commit -m "Update Vertex AI function to use individual credential fields"
git push origin develop
```

Netlify will automatically deploy with the new configuration.
