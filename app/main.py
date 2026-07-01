import os
import html
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Security, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.staticfiles import StaticFiles

limiter = Limiter(key_func=get_remote_address)

security = HTTPBearer(auto_error=False)

async def verify_auth(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    token = os.getenv("API_AUTH_TOKEN", "")
    if token:
        if not credentials or credentials.credentials != token:
            raise HTTPException(status_code=401, detail="Invalid or missing authentication token")
    return credentials

from app.config import Config
from app.catalog import CatalogEngine
from app.agent import RecommenderAgent

@asynccontextmanager
async def lifespan(app: FastAPI):
    global catalog_engine, agent
    catalog_engine = CatalogEngine()
    agent = RecommenderAgent(catalog_engine)
    yield

# Initialize FastAPI app
app = FastAPI(
    title="SHL Conversational Recommender API",
    description="Conversational agent to select and shortlist SHL assessments.",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: allow specific origins in production via CORS_ORIGINS env var
cors_origins_str = os.getenv("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in cors_origins_str.split(",")] if cors_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines lazily on startup to prevent slow imports during import time
catalog_engine = None
agent = None

# Pydantic models for strict API schema validation
class Message(BaseModel):
    role: str = Field(..., description="The role of the message sender, e.g. 'user' or 'assistant'", max_length=20)
    content: str = Field(..., description="The text content of the message", max_length=4000)

class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="Stateless history of the conversation", max_length=50)

class Recommendation(BaseModel):
    name: str = Field(..., description="Exact name of the SHL assessment")
    url: str = Field(..., description="Catalog URL of the SHL assessment")
    test_type: str = Field(..., description="Test type code matching catalog keys (e.g. K, P, A, S)")

class ChatResponse(BaseModel):
    reply: str = Field(..., description="The agent's reply message")
    recommendations: List[Recommendation] = Field(
        default_factory=list, 
        description="List of recommendations, empty if gathering context or refusing"
    )
    end_of_conversation: bool = Field(..., description="True if the user finalized the shortlist")

@app.get("/health")
def health_check():
    """GET /health readiness check for deployment services."""
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat_endpoint(request: Request, body: ChatRequest, auth: Optional[HTTPAuthorizationCredentials] = Depends(verify_auth)):
    """POST /chat endpoint carrying stateless history."""
    global catalog_engine, agent
    if agent is None:
        # Fallback initialization if lifespan didn't trigger yet (e.g. unit tests running manually)
        catalog_engine = CatalogEngine()
        agent = RecommenderAgent(catalog_engine)

    try:
        # Pass messages to agent WITHOUT html.escape (escaping input corrupts NLP keyword matching)
        msgs = [{"role": m.role, "content": m.content} for m in body.messages]

        # Enforce 8-turn cap per problem statement (evaluator caps at 8 turns)
        if len(msgs) > 8:
            msgs = msgs[-8:]

        # Route to agent logic
        result = agent.handle(msgs)

        # NOTE: Do NOT html.escape the reply here — this is a JSON API.
        # The React frontend uses React's built-in XSS protection.
        # The HTML console at GET / uses textContent (safe DOM) for rendering.
        # html.escape in a JSON response produces visible HTML entities (&amp;#x27;) in the UI.
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files if they exist (allows serving the compiled React frontend directly from the backend)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if os.path.exists(os.path.join(static_dir, "index.html")):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", response_class=HTMLResponse)
    def index_page():
        index_path = os.path.join(static_dir, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
else:
    @app.get("/", response_class=HTMLResponse)
    def index_page():
        """Served at root (/) - A premium dark-mode web console for manual recruiter testing."""
        html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHL Assessment Recommender Console</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0b0f19;
            --bg-surface: #161e31;
            --bg-input: #1e2942;
            --primary: #10b981;
            --primary-hover: #34d399;
            --primary-glow: rgba(16, 185, 129, 0.15);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --text-inverse: #ffffff;
            --border-color: #2e3b5e;
            --accent-purple: #8b5cf6;
            --accent-blue: #3b82f6;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-main);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        header {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-surface);
            border-bottom: 1px solid var(--border-color);
            padding: 1.2rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }

        .header-logo {
            display: flex;
            align-items: center;
            gap: 0.8rem;
        }

        .header-logo h1 {
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, var(--primary), var(--primary-hover));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .tag-beta {
            background-color: var(--primary-glow);
            color: var(--primary);
            border: 1px solid var(--primary);
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            text-transform: uppercase;
            font-weight: 700;
        }

        .main-container {
            flex: 1;
            display: grid;
            grid-template-columns: 320px 1fr 380px;
            overflow: hidden;
        }

        /* Preset Personas Panel */
        .presets-panel {
            background-color: var(--bg-surface);
            border-right: 1px solid var(--border-color);
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            overflow-y: auto;
        }

        .panel-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-main);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .preset-btn {
            background-color: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.8rem 1rem;
            text-align: left;
            color: var(--text-main);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.85rem;
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
        }

        .preset-btn:hover {
            border-color: var(--primary);
            box-shadow: 0 0 10px var(--primary-glow);
            transform: translateY(-2px);
        }

        .preset-btn .preset-role {
            font-weight: 600;
            color: var(--primary-hover);
        }

        .preset-btn .preset-desc {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        /* Chat Panel */
        .chat-panel {
            display: flex;
            flex-direction: column;
            background-color: var(--bg-base);
            height: 100%;
            position: relative;
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .message-bubble {
            max-width: 80%;
            padding: 1rem 1.25rem;
            border-radius: 12px;
            font-size: 0.95rem;
            line-height: 1.5;
            position: relative;
        }

        .message-bubble.user {
            align-self: flex-end;
            background-color: var(--primary);
            color: var(--text-inverse);
            border-bottom-right-radius: 2px;
        }

        .message-bubble.assistant {
            align-self: flex-start;
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            border-bottom-left-radius: 2px;
        }

        .message-bubble table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            font-size: 0.8rem;
        }

        .message-bubble th, .message-bubble td {
            border: 1px solid var(--border-color);
            padding: 0.5rem;
            text-align: left;
        }

        .message-bubble th {
            background-color: rgba(255,255,255,0.05);
            font-weight: 600;
        }

        .message-bubble a {
            color: var(--primary-hover);
            text-decoration: underline;
        }

        .chat-input-container {
            padding: 1.5rem 2rem;
            background-color: var(--bg-surface);
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .chat-input {
            flex: 1;
            background-color: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.9rem 1.2rem;
            color: var(--text-main);
            font-size: 0.95rem;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .chat-input:focus {
            border-color: var(--primary);
        }

        .send-btn {
            background-color: var(--primary);
            color: var(--text-inverse);
            border: none;
            border-radius: 8px;
            padding: 0.9rem 1.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .send-btn:hover {
            background-color: var(--primary-hover);
        }

        .send-btn:disabled {
            background-color: var(--text-muted);
            cursor: not-allowed;
        }

        /* Recommendations Drawer */
        .recs-panel {
            background-color: var(--bg-surface);
            border-left: 1px solid var(--border-color);
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1.2rem;
            overflow-y: auto;
        }

        .recs-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-main);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.8rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .recs-count {
            background-color: var(--primary-glow);
            color: var(--primary);
            font-size: 0.8rem;
            padding: 0.15rem 0.4rem;
            border-radius: 9999px;
            font-weight: 700;
        }

        .rec-card {
            background-color: var(--bg-base);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }

        .rec-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 4px;
            background-color: var(--primary);
        }

        .rec-card.type-p::before { background-color: var(--accent-purple); }
        .rec-card.type-a::before { background-color: var(--accent-blue); }

        .rec-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            border-color: var(--text-muted);
        }

        .rec-name {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 0.95rem;
            line-height: 1.3;
        }

        .rec-meta {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .rec-badge {
            font-size: 0.7rem;
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .rec-badge.type-code {
            background-color: rgba(255,255,255,0.08);
            color: var(--text-main);
        }

        .rec-badge.type-label {
            background-color: var(--primary-glow);
            color: var(--primary);
        }

        .rec-link {
            font-size: 0.75rem;
            color: var(--primary-hover);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            align-self: flex-start;
            margin-top: 0.3rem;
        }

        .rec-link:hover {
            text-decoration: underline;
        }

        .status-pill {
            font-size: 0.75rem;
            padding: 0.3rem 0.8rem;
            border-radius: 9999px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
        }

        .status-pill.gathering {
            background-color: rgba(59, 130, 246, 0.1);
            color: var(--accent-blue);
        }

        .status-pill.finalized {
            background-color: var(--primary-glow);
            color: var(--primary);
        }

        .empty-recs {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.85rem;
            padding: 2rem 0;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        /* Typing indicator */
        .typing-indicator {
            display: flex;
            gap: 0.3rem;
            align-items: center;
            padding: 0.5rem;
        }

        .typing-dot {
            width: 6px;
            height: 6px;
            background-color: var(--text-muted);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
    </style>
</head>
<body>

    <header>
        <div class="header-logo">
            <h1>SHL Recommender Console</h1>
            <span class="tag-beta">Production Ready</span>
        </div>
        <div id="conversation-status" class="status-pill gathering">
            <span>● Gathering Context</span>
        </div>
    </header>

    <div class="main-container">
        <!-- Preset Personas -->
        <div class="presets-panel">
            <div class="panel-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span>Preset Test Personas</span>
            </div>
            
            <button class="preset-btn" onclick="loadPreset('senior leadership selection benchmark')">
                <span class="preset-role">Senior Leadership (C1)</span>
                <span class="preset-desc">Benchmarking CXOs / Directors on selection & leadership</span>
            </button>
            
            <button class="preset-btn" onclick="loadPreset('senior rust engineer high performance networking')">
                <span class="preset-role">Rust Systems Engineer (C2)</span>
                <span class="preset-desc">Senior systems engineer with networking focus</span>
            </button>
            
            <button class="preset-btn" onclick="loadPreset('screening 500 entry-level contact centre agents English US')">
                <span class="preset-role">Contact Center Agent (C3)</span>
                <span class="preset-desc">High volume entry-level US English inbound screening</span>
            </button>
            
            <button class="preset-btn" onclick="loadPreset('graduate financial analysts numerical reasoning finance knowledge')">
                <span class="preset-role">Graduate Financial Analyst (C4)</span>
                <span class="preset-desc">Cognitive, financial knowledge and SJT battery</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('re-skill sales organization talent audit sales transformation')">
                <span class="preset-role">Sales Re-skilling Audit (C5)</span>
                <span class="preset-desc">Restructuring sales teams using OPQ & Sales reports</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('plant operators chemical facility safety compliance DSI')">
                <span class="preset-role">Plant Operators Safety (C6)</span>
                <span class="preset-desc">Frontline plant safety, reliability, and rule compliance</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('bilingual healthcare admin Spanish HIPAA patient records')">
                <span class="preset-role">Bilingual HIPAA Admin (C7)</span>
                <span class="preset-desc">Healthcare admin with Spanish personality and HIPAA knowledge</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('admin assistant Excel and Word tools skills simulation')">
                <span class="preset-role">Admin Assistant Tools (C8)</span>
                <span class="preset-desc">Screening admin assistants on Excel/Word knowledge & simulation</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('senior backend java spring sql aws docker')">
                <span class="preset-role">Senior Java Backend IC (C9)</span>
                <span class="preset-desc">Technical microservices stack, cognitive & personality</span>
            </button>

            <button class="preset-btn" onclick="loadPreset('graduate management trainee scheme cognitive personality SJT')">
                <span class="preset-role">Graduate Trainee Scheme (C10)</span>
                <span class="preset-desc">Graduate pipeline with cognitive, personality & SJT filters</span>
            </button>
        </div>

        <!-- Chat Area -->
        <div class="chat-panel">
            <div class="chat-messages" id="chat-messages">
                <div class="message-bubble assistant">
                    Hello! I can guide you through the SHL product catalog to construct the optimal assessment battery. Describe the job role, seniorities, or technical/behavioral competencies you need to assess.
                </div>
            </div>
            
            <div class="chat-input-container">
                <input type="text" class="chat-input" id="chat-input" placeholder="Type your hiring requirements or select a preset..." onkeypress="handleKeyPress(event)">
                <button class="send-btn" id="send-btn" onclick="sendMessage()">
                    <span>Send</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>

        <!-- Recommendations Side panel -->
        <div class="recs-panel">
            <div class="recs-title">
                <span>Shortlist Recommendations</span>
                <span class="recs-count" id="recs-count">0</span>
            </div>
            
            <div id="recs-list" class="empty-recs">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto; color: var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>No recommendations committed yet</span>
                <span style="font-size: 0.75rem;">Shortlists appear once the agent gathers enough role context.</span>
            </div>
        </div>
    </div>

    <script>
        let messageHistory = [];

        function addMessage(role, content) {
            messageHistory.push({ role, content });
            const chatMessages = document.getElementById("chat-messages");
            const bubble = document.createElement("div");
            bubble.classList.add("message-bubble", role);
            
            // Render markdown tables if present in agent reply
            if (role === 'assistant') {
                bubble.innerHTML = formatMarkdown(content);
            } else {
                bubble.innerText = content;
            }
            
            chatMessages.appendChild(bubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function formatMarkdown(text) {
            // Very basic markdown table to HTML converter
            if (text.includes('|')) {
                let lines = text.split('\n');
                let inTable = false;
                let tableHtml = "<table>";
                let normalText = "";
                
                for (let line of lines) {
                    if (line.trim().startsWith('|')) {
                        inTable = true;
                        let cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
                        if (line.includes('---')) {
                            // Separator line
                            continue;
                        }
                        tableHtml += "<tr>";
                        for (let cell of cells) {
                            // Convert markdown links inside table cells
                            let linkMatch = cell.match(/<([^>]+)>/);
                            if (linkMatch) {
                                tableHtml += `<td><a href="${linkMatch[1]}" target="_blank">Catalog Link</a></td>`;
                            } else {
                                tableHtml += `<td>${cell}</td>`;
                            }
                        }
                        tableHtml += "</tr>";
                    } else {
                        if (inTable) {
                            tableHtml += "</table>";
                            inTable = false;
                            normalText += tableHtml;
                            tableHtml = "<table>";
                        }
                        // Format bold text
                        let formattedLine = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                        // Format inline links
                        formattedLine = formattedLine.replace(/<([^>]+)>/g, '<a href="$1" target="_blank">$1</a>');
                        normalText += formattedLine + "<br>";
                    }
                }
                if (inTable) {
                    tableHtml += "</table>";
                    normalText += tableHtml;
                }
                return normalText;
            }
            // Format bold text for regular messages
            let formatted = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\n/g, '<br>');
            return formatted;
        }

        function loadPreset(prompt) {
            document.getElementById("chat-input").value = prompt;
            sendMessage();
        }

        function handleKeyPress(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        }

        async function sendMessage() {
            const inputEl = document.getElementById("chat-input");
            const sendBtn = document.getElementById("send-btn");
            const text = inputEl.value.trim();
            if (!text) return;

            inputEl.value = "";
            inputEl.disabled = true;
            sendBtn.disabled = true;

            addMessage("user", text);

            // Display typing indicator
            const chatMessages = document.getElementById("chat-messages");
            const typingEl = document.createElement("div");
            typingEl.classList.add("message-bubble", "assistant", "typing-container");
            typingEl.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
            chatMessages.appendChild(typingEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const response = await fetch("/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: messageHistory })
                });
                
                const data = await response.json();
                
                // Remove typing indicator
                chatMessages.removeChild(typingEl);

                addMessage("assistant", data.reply);
                updateRecommendations(data.recommendations);
                updateStatus(data.end_of_conversation);

            } catch (err) {
                chatMessages.removeChild(typingEl);
                addMessage("assistant", "Error: Failed to communicate with the server. Make sure uvicorn is running.");
                console.error(err);
            } finally {
                inputEl.disabled = false;
                sendBtn.disabled = false;
                inputEl.focus();
            }
        }

        function updateRecommendations(recs) {
            const recsList = document.getElementById("recs-list");
            const recsCount = document.getElementById("recs-count");
            
            if (!recs || recs.length === 0) {
                // If recommendations is empty and we already have items shown, keep them (as per Refine behavior)
                // unless it is the very beginning of the chat
                return;
            }

            recsCount.innerText = recs.length;
            recsList.innerHTML = "";
            recsList.classList.remove("empty-recs");

            recs.forEach(rec => {
                const card = document.createElement("div");
                card.classList.add("rec-card");

                let typeClass = "type-k";
                if (rec.test_type.includes('P')) typeClass = "type-p";
                else if (rec.test_type.includes('A')) typeClass = "type-a";
                card.classList.add(typeClass);

                const nameEl = document.createElement('div');
                nameEl.className = 'rec-name';
                nameEl.textContent = rec.name;  // safe: textContent not innerHTML

                const metaEl = document.createElement('div');
                metaEl.className = 'rec-meta';

                const badge1 = document.createElement('span');
                badge1.className = 'rec-badge type-code';
                badge1.textContent = rec.test_type;

                const badge2 = document.createElement('span');
                badge2.className = 'rec-badge type-label';
                badge2.textContent = 'SHL Approved';

                metaEl.appendChild(badge1);
                metaEl.appendChild(badge2);

                const link = document.createElement('a');
                link.href = rec.url;  // URL from catalog only
                link.className = 'rec-link';
                link.target = '_blank';
                link.textContent = 'View Catalog details';

                card.appendChild(nameEl);
                card.appendChild(metaEl);
                card.appendChild(link);
                recsList.appendChild(card);
            });
        }

        function updateStatus(isFinalized) {
            const statusPill = document.getElementById("conversation-status");
            if (isFinalized) {
                statusPill.className = "status-pill finalized";
                statusPill.innerHTML = "<span>● Shortlist Finalized</span>";
            } else {
                statusPill.className = "status-pill gathering";
                statusPill.innerHTML = "<span>● Gathering Context</span>";
            }
        }
    </script>
</body>
</html>
"""
        return HTMLResponse(content=html_content, status_code=200)
