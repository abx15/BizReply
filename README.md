# BizReply - AI-Powered WhatsApp Chatbot for Businesses

BizReply is a premium, modern, multi-tenant WhatsApp automation SaaS platform built for local businesses. It utilizes the Meta WhatsApp Cloud API and Anthropic Claude AI to automatically answer customer queries based on a business's custom Knowledge Base (FAQs, Products, Services, Policies).

---

## 🏗️ System Architecture & Workflow

Here is a visual representation of how BizReply handles incoming customer messages, generates AI auto-replies, and updates the dashboard in real-time.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 📱 Customer
    participant Meta as 🌐 Meta Cloud API
    participant Backend as ⚙️ Express Backend
    participant DB as 🗄️ MongoDB Atlas
    participant AI as 🧠 Claude AI Service
    participant Frontend as 💻 React/Vite Dashboard

    Customer->>Meta: Sends WhatsApp Message (e.g. "What are your hours?")
    Meta->>Backend: Post Webhook Event (POST /api/webhook)
    activate Backend
    Backend->>DB: Logs Inbound Message & updates Conversation
    Backend-->>Meta: Returns 200 OK (Immediately)
    
    Backend->>Frontend: Emits Socket Event (new_message)
    Frontend-->>Backend: Renders new chat bubble in real-time

    Note over Backend, DB: Fetch Business Profile & Knowledge Base Items
    Backend->>DB: Find Business & Knowledge Items
    DB-->>Backend: Returns items (hours, prices, catalog)
    
    Note over Backend, AI: Generate contextual Hinglish response
    Backend->>AI: generateReply(message, history, knowledge)
    AI-->>Backend: Returns JSON { reply, confidence }
    
    alt confidence is high (>= 0.7)
        Backend->>Meta: Send message (Meta Cloud API)
        Meta->>Customer: Delivers WhatsApp response
        Backend->>DB: Logs Outbound Message (handledBy: "ai")
        Backend->>Frontend: Emits Socket Event (ai_replied)
    else confidence is low (< 0.7)
        Backend->>DB: Updates Conversation Status to "needs_attention"
        Backend->>Frontend: Emits Socket Event (conversationStatusChanged)
        Note over Frontend: Highlights chat in orange for manual takeover
    end
    deactivate Backend
```

---

## 🔌 WhatsApp Connection & Webhook Setup Workflow

Follow this step-by-step flowchart to link your Meta WhatsApp Cloud API credentials to BizReply and configure incoming message webhooks:

```mermaid
flowchart TD
    Start([🚀 Connect WhatsApp]) --> Step1[1. Register / Login on BizReply Portal]
    Step1 --> Step2[2. Go to Meta Developers Portal]
    Step2 --> Step3[3. Create Meta App & Add WhatsApp Cloud API product]
    Step3 --> Step4[4. Get Phone Number ID & System User Access Token]
    Step4 --> Step5[5. Save credentials in BizReply Dashboard -> Settings]
    Step5 --> Step6[6. Configure Webhook URL & Verify Token in Meta WhatsApp App]
    Step6 --> Step7[7. Subscribe to 'messages' field in Meta webhook setup]
    Step7 --> Step8[8. Toggle ON 'Enable Global AI Auto-Replies']
    Step8 --> Success([🎉 Connected! Chatbot starts replying instantly])

    style Start fill:#10b981,stroke:#047857,color:#fff
    style Success fill:#10b981,stroke:#047857,color:#fff
    style Step5 fill:#4f46e5,stroke:#3730a3,color:#fff
    style Step6 fill:#4f46e5,stroke:#3730a3,color:#fff
```

### 📋 Setup & Verification Guide

1. **Get Meta Developer Details**:
   - Visit the [Meta for Developers](https://developers.facebook.com/) portal.
   - Setup a Business App, navigate to **WhatsApp** -> **API Setup**.
   - Copy the **Phone Number ID** (e.g., `1055598124991`) and generate a permanent **System User Access Token**.

2. **Save Settings in BizReply**:
   - Log into BizReply and navigate to [System Settings](file:///c:/Users/arunk/Desktop/BizReply/frontend/src/pages/Settings.tsx).
   - Enter your **WhatsApp Connected Number** (with country code), **Meta Phone ID**, and **Meta Cloud API Token**. Click **Save Settings**.

3. **Configure Webhook in Meta**:
   - In Meta Developers App, go to **WhatsApp** -> **Configuration**.
   - Set **Callback URL** to: `https://<your-backend-api-url>/api/webhook` (for local dev, use an ngrok or localtunnel URL pointing to port `5000` or `5088`).
   - Set **Verify Token** to the value of `META_WEBHOOK_VERIFY_TOKEN` (default is `your_custom_webhook_verify_token`).
   - **Click Verify and Save**.
   - Click **Manage Webhook Fields** and **Subscribe** to `messages`.

---

## 🌟 Key Features

1. **AI Auto-Responder (Hinglish/English)**:
   - Contextual understanding of customer queries using Claude-3-Haiku.
   - Built-in localized **Hinglish fallback responder** (e.g., *"Mujhe is baare mein abhi jankari nahi hai. Business owner se confirm karke aapko batata hoon."*) for low-confidence queries or offline modes.
2. **Real-time Live Chat Panel**:
   - Full live-chat dashboard using **Socket.io** to take over chats manually.
   - Distinct statuses: `active`, `needs_attention` (requires manual reply), and `resolved`.
3. **Flexible Knowledge Base**:
   - Manually insert items or upload bulk lists using an Excel/Spreadsheet parser.
4. **Pro Broadcast Campaigns**:
   - Send template/custom broadcasts to lists of phone numbers.
   - Outbox queue manager with automatic cron scheduling.
5. **Subscription Billing Gate**:
   - Multi-tier subscriptions (`free`, `starter`, `pro`) integrated with **Razorpay**.
   - Automatic limits gating on broadcasts based on tier.

---

## 🚀 Getting Started

### 🔌 Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env` (use `.env.example` as a template):
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=your_jwt_secret
   MOCK_SERVICES=true   # Set to 'false' to use real Anthropic & WhatsApp API endpoints
   ```
4. Run in development mode:
   ```bash
   npm run dev
   ```

### 💻 Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

---

## 🛠️ Developer Utility Scripts

Located in `backend/scratch/`:

*   **Database connection check**:
    ```bash
    npx ts-node scratch/verify_db.ts
    ```
*   **Full API Endpoints & webhook workflow test**:
    ```bash
    npx ts-node scratch/verify_api_services.ts
    ```
*   **Manually update business subscription tier**:
    ```bash
    npx ts-node scratch/change_plan.ts <business_email> <free|starter|pro>
    ```

---

## 📝 Licence

Distributed under the ISC License. Created with ❤️ by Arun Kumar Bind.
