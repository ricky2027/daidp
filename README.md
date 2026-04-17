📄 🚀 Voicepay Project Setup Guide
🧑‍💻 Prerequisites

Make sure you have:

Node.js (v18 or above)
npm (comes with Node)
pnpm (we’ll install it)
⚙️ 1. Project Setup
📦 Step 1: Extract the ZIP

Extract the project anywhere, e.g.:

C:\Users\YourName\Desktop\Voicepay
📂 Step 2: Open terminal in root folder
cd Voicepay
🔧 Step 3: Install pnpm (if not installed)
npm install -g pnpm
📥 Step 4: Install all dependencies
pnpm install
🔐 2. Backend Setup (API Server)
📂 Step 1: Go to backend folder
cd artifacts/api-server
📝 Step 2: Setup .env file

Create or edit .env:

PORT=3000
NODE_ENV=development
SARVAM_API_KEY=your_api_key_here
SESSION_SECRET=your_secret_here

⚠️ Rules:

No quotes
No spaces around =
▶️ Step 3: Run backend
pnpm exec tsx ./src/index.ts
✅ Expected Output
Server listening on port 3000
📱 3. Frontend Setup (Expo App)
📂 Step 1: Go to frontend folder

From root:

cd artifacts/awaazpe
▶️ Step 2: Start frontend
pnpm expo start
