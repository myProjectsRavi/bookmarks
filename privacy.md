# LinkHaven - Privacy Features

> **Purpose**: Document all privacy features and practices for users and developers.

---

## Core Privacy Philosophy

LinkHaven is built with **privacy-first** principles:

1. **No Server Storage** - Your data never leaves your device
2. **No Analytics** - No tracking, no telemetry, no cookies
3. **No Account Required** - Use immediately, no email needed
4. **Open Source** - Full code transparency

---

## 1. Local-Only Data Storage

### Implementation
- All data stored in browser localStorage
- No network requests to store user data
- Data remains on user's device

### Benefits
- No cloud breaches possible
- No data mining
- Complete user control

---

## 2. PIN-Protected Access

### Features
- 4-digit minimum PIN requirement
- SHA-256 hashed storage (PIN itself never stored)
- Session-based authentication
- Manual lock available anytime

### User Control
- User sets their own PIN
- No password recovery (by design)
- No backdoors

---

## 3. End-to-End Encrypted Note Sharing

### How It Works
1. **You create**: Note encrypted with YOUR password
2. **You share**: Encrypted code sent via WhatsApp/SMS
3. **Friend receives**: Needs YOUR password + our app
4. **Result**: Even we can't read it

### Technical Details
- AES-256-GCM encryption
- Password never transmitted with code
- Each share has unique encryption keys

### Privacy Guarantee
> **Even if someone intercepts the share code, they cannot decrypt it without the password.**

---

## 4. No External Data Leaks

### What We DON'T Do
- ❌ Send data to servers
- ❌ Use analytics (Google Analytics, Mixpanel, etc.)
- ❌ Track user behavior
- ❌ Store cookies
- ❌ Require login/signup
- ❌ Access address book/contacts
- ❌ Access location data

### Network Requests
Only network requests made:
1. **Favicon fetching** - For bookmark icons (external URLs)
2. **URL metadata** - Title/description for new bookmarks

These never include user's personal data.

---

## 5. Data Portability

### Export Options
- **QR Sync**: Export all data as encrypted code
- **Notebook Sync**: Export notes only
- **Future**: JSON/CSV export

### User Rights
- Export anytime
- Delete anytime (clear localStorage)
- No lock-in

---

## 6. Transparent Sync Mechanism

### How Sync Works
```
Your Device → Generate Code → Share Manually → Friend's Device
              (offline)     (WhatsApp/SMS)      (paste code)
```

### Privacy Properties
- No cloud intermediary
- You control who receives codes
- Codes expire conceptually (new code overwrites)

---

## 7. Client-Side Processing

### All Processing Local
- Search filtering → Client
- Tag filtering → Client
- Encryption → Client
- Decryption → Client

### No Server = No Logs
- No IP addresses recorded
- No access timestamps
- No usage patterns stored

---

## 8. Open Source Transparency

### Verify Our Claims
- Full source code available
- No hidden tracking code
- Community auditable

---

## Privacy Comparison

| Feature | LinkHaven | Typical Cloud Apps |
|---------|-----------|-------------------|
| Server Storage | ❌ None | ✅ Required |
| Analytics | ❌ None | ✅ Extensive |
| Account Required | ❌ No | ✅ Yes |
| Data Mining | ❌ None | ✅ Common |
| E2E Encryption | ✅ Built-in | ⚠️ Rare |
| Offline Usage | ✅ Full | ⚠️ Limited |

---

## Data Retention

| Data Type | Retention | Location |
|-----------|-----------|----------|
| Bookmarks | Until deleted | localStorage |
| Notes | Until deleted | localStorage |
| PIN Hash | Until reset | localStorage |
| Shared Note Codes | Not stored | Recipient's device |

---

## User Rights

Under GDPR and similar regulations:

| Right | Implementation |
|-------|----------------|
| Access | All data visible in app |
| Deletion | Clear localStorage |
| Portability | Sync code export |
| Rectification | Edit any item |

---

## Privacy Contact

For privacy concerns: [Repository Issues](https://github.com/myProjectsRavi/linkhaven/issues)
