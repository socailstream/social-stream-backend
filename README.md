# Social Stream Backend

Production-ready Node.js backend for social media account connections and posting.

## Features

- **Facebook OAuth** - Connect Facebook Pages for posting
- **Instagram OAuth** - Connect Instagram Business accounts (via Facebook)
- **Pinterest OAuth** - Connect Pinterest accounts for pin creation
- **Long-lived tokens** - Automatic token refresh for extended access
- **Dual storage** - MongoDB + optional Firestore support

## Tech Stack

- Node.js + Express
- Firebase Admin SDK (Auth + Firestore)
- MongoDB (Mongoose)
- Axios for API calls

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create a `.env` file (see `ENV_SETUP.md` for all variables):

```env
NODE_ENV=development
PORT=5000
BASE_URL=http://localhost:5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/social-stream

# Facebook/Meta
FB_APP_ID=your_app_id
FB_APP_SECRET=your_app_secret
FB_REDIRECT_URI=http://localhost:5000/api/social/facebook/callback

# Pinterest
PINTEREST_CLIENT_ID=your_client_id
PINTEREST_CLIENT_SECRET=your_client_secret
PINTEREST_REDIRECT_URI=http://localhost:5000/api/social/pinterest/callback
```

### 3. Add Firebase Service Account

Place your `serviceAccountKey.json` in the `config/` folder.

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication Required
All endpoints except OAuth callbacks require a Bearer token in the Authorization header.

### Account Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/accounts` | Get all connected accounts |

### Facebook

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/facebook/connect` | Get OAuth URL |
| GET | `/api/social/facebook/callback` | OAuth callback |
| DELETE | `/api/social/facebook/disconnect` | Disconnect account |
| POST | `/api/social/facebook/post` | Post to Facebook Page |

### Instagram

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/instagram/connect` | Get OAuth URL |
| GET | `/api/social/instagram/callback` | OAuth callback |
| DELETE | `/api/social/instagram/disconnect` | Disconnect account |
| POST | `/api/social/instagram/post` | Post to Instagram |

### Pinterest

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/pinterest/connect` | Get OAuth URL |
| GET | `/api/social/pinterest/callback` | OAuth callback |
| DELETE | `/api/social/pinterest/disconnect` | Disconnect account |
| POST | `/api/social/pinterest/post` | Create a pin |

---

## Testing with Postman

### Step 1: Get Firebase Token

First, sign in to your app and get a Firebase ID token. In your Flutter app, you can get it with:

```dart
String? token = await FirebaseAuth.instance.currentUser?.getIdToken();
print(token);
```

### Step 2: Test Endpoints

#### Get Connected Accounts

```
GET http://localhost:5000/api/social/accounts
Headers:
  Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Connect Facebook

```
GET http://localhost:5000/api/social/facebook/connect
Headers:
  Authorization: Bearer YOUR_FIREBASE_TOKEN
```

Response:
```json
{
  "success": true,
  "authUrl": "https://www.facebook.com/v24.0/dialog/oauth?..."
}
```

Open the `authUrl` in a browser to complete OAuth.

#### Disconnect Facebook

```
DELETE http://localhost:5000/api/social/facebook/disconnect
Headers:
  Authorization: Bearer YOUR_FIREBASE_TOKEN
```

---

## Testing OAuth Flows

### Facebook/Instagram Testing

1. **Create Facebook App**
   - Go to https://developers.facebook.com/apps/
   - Create new app → Business type
   - Add "Facebook Login" product
   - Configure OAuth settings with your callback URL

2. **Add Test Users**
   - In App Dashboard → Roles → Test Users
   - Create test users or add your own account

3. **Request Permissions**
   - Before going live, request review for:
     - `pages_manage_posts`
     - `instagram_basic`
     - `instagram_content_publish`

### Pinterest Testing

1. **Create Pinterest App**
   - Go to https://developers.pinterest.com/apps/
   - Create new app
   - Enable required scopes

2. **Sandbox Mode**
   - Pinterest apps start in sandbox mode
   - Test with your own Pinterest account

---

## cURL Examples

### Get Connected Accounts

```bash
curl -X GET http://localhost:5000/api/social/accounts \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Connect Facebook

```bash
curl -X GET http://localhost:5000/api/social/facebook/connect \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Post to Facebook Page

```bash
curl -X POST http://localhost:5000/api/social/facebook/post \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello from Social Stream!",
    "link": "https://example.com"
  }'
```

### Post to Instagram

```bash
curl -X POST http://localhost:5000/api/social/instagram/post \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Posted via Social Stream #api"
  }'
```

### Create Pinterest Pin

```bash
curl -X POST http://localhost:5000/api/social/pinterest/post \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": "YOUR_BOARD_ID",
    "imageUrl": "https://example.com/image.jpg",
    "title": "My Pin",
    "description": "Created via API",
    "link": "https://example.com"
  }'
```

### Disconnect Account

```bash
# Facebook
curl -X DELETE http://localhost:5000/api/social/facebook/disconnect \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Instagram
curl -X DELETE http://localhost:5000/api/social/instagram/disconnect \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Pinterest
curl -X DELETE http://localhost:5000/api/social/pinterest/disconnect \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## Project Structure

```
backend/
├── config/
│   ├── database.js           # MongoDB connection
│   ├── firebase.js           # Firebase Admin SDK
│   ├── serviceAccountKey.json # Firebase credentials
│   └── social.config.js      # OAuth configuration
├── controllers/
│   ├── post.controller.js
│   ├── social.controller.js  # OAuth & posting logic
│   └── user.controller.js
├── middleware/
│   └── auth.middleware.js    # Firebase token verification
├── models/
│   ├── Post.model.js
│   └── User.model.js         # User schema with connectedAccounts
├── routes/
│   ├── post.routes.js
│   ├── social.routes.js      # Social media endpoints
│   └── user.routes.js
├── services/
│   ├── facebook.service.js   # Facebook API wrapper
│   ├── instagram.service.js  # Instagram API wrapper
│   ├── pinterest.service.js  # Pinterest API wrapper
│   └── firestore.service.js  # Firestore storage (optional)
├── ENV_SETUP.md              # Environment variables guide
├── package.json
├── README.md
└── server.js                 # Express server entry
```

---

## Common Issues

### "No Instagram Business Account found"

Instagram posting requires:
1. A Facebook Page
2. An Instagram Business or Creator account
3. The Instagram account linked to the Facebook Page

### "Token expired"

Long-lived tokens last 60 days for Facebook/Instagram. Implement a token refresh job or handle 401 errors in your app.

### "Invalid redirect_uri"

Make sure your callback URLs in `.env` exactly match what's configured in Facebook/Pinterest developer consoles.

---

## License

MIT
