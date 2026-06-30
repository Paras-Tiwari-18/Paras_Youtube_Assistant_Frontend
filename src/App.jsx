import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/chat";

function createSessionId() {
  return "chat-" + crypto.randomUUID();
}

function beautifyMarkdown(text) {
  if (!text) return "";
  return text.replace(/\n{3,}/g, "\n\n").replace(/â€¢/g, "-").trim();
}

export default function App() {
  const [chats, setChats] = useState(() => {
    return JSON.parse(localStorage.getItem("yt_chats")) || [];
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("yt_chats", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, loading]);

  const activeChat = chats.find((c) => c.id === activeChatId);

  function startNewChat() {
    const newChat = {
      id: createSessionId(),
      title: "New Chat",
      youtubeUrl: "",
      messages: [
        {
          role: "assistant",
          content:
            "👋 **New chat started!**\n\nPaste a YouTube link above and click **Load Video**.",
        },
      ],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }

  function deleteChat(chatId) {
    if (!window.confirm("Delete this chat?")) return;

    setChats((prev) => prev.filter((c) => c.id !== chatId));

    if (chatId === activeChatId) {
      const remaining = chats.filter((c) => c.id !== chatId);
      setActiveChatId(remaining[0]?.id || null);
    }
  }

  function updateChat(update) {
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, ...update } : c))
    );
  }

  async function loadVideo(url) {
    if (!url || !activeChat || videoLoading) return;

    try {
      setVideoLoading(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeChat.id,
          message: "__load_video__",
          youtube_url: url,
        }),
      });

      if (!res.ok) {
        throw new Error(`Video load failed with status ${res.status}`);
      }

      updateChat({
        youtubeUrl: url,
        messages: [
          ...activeChat.messages,
          {
            role: "assistant",
            content:
              "✅ **Video loaded successfully!**\n\nYou can now ask questions related to the video.",
          },
        ],
      });
    } catch {
      updateChat({
        messages: [
          ...activeChat.messages,
          {
            role: "assistant",
            content: "❌ Failed to load video. Please try again.",
          },
        ],
      });
    } finally {
      setVideoLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeChat) return;

    const userMessage = { role: "user", content: input };
    updateChat({ messages: [...activeChat.messages, userMessage] });

    setInput("");
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeChat.id,
          message: input,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat request failed with status ${res.status}`);
      }

      const data = await res.json();

      updateChat({
        messages: [
          ...activeChat.messages,
          userMessage,
          { role: "assistant", content: beautifyMarkdown(data.reply) },
        ],
      });

      if (activeChat.title === "New Chat") {
        updateChat({ title: input.slice(0, 40) });
      }
    } catch {
      updateChat({
        messages: [
          ...activeChat.messages,
          userMessage,
          { role: "assistant", content: "⚠️ Something went wrong." },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={startNewChat}>
          + New Chat
        </button>

        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === activeChatId ? "active" : ""}`}
          >
            <span onClick={() => setActiveChatId(chat.id)}>{chat.title}</span>
            <button
              className="delete-chat-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(chat.id);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </aside>

      <main className="chat-main">
        {!activeChat ? (
          <div className="empty-state">
            <h2>YouTube AI Tutor</h2>
            <button onClick={startNewChat}>New Chat</button>
          </div>
        ) : (
          <>
            <header className="header">
              <h2>YouTube AI Tutor</h2>
            </header>

            <div className="video-input">
              <input
                placeholder="Paste a YouTube URL..."
                value={activeChat.youtubeUrl}
                onChange={(e) => updateChat({ youtubeUrl: e.target.value })}
              />
              <button
                onClick={() => loadVideo(activeChat.youtubeUrl)}
                disabled={videoLoading}
              >
                {videoLoading ? "Loading..." : "Load Video"}
              </button>
            </div>

            {videoLoading && (
              <div className="video-loader">
                <span className="spinner" />
                <span>Loading video & preparing notes...</span>
              </div>
            )}

            <div className="chat-container">
              {activeChat.messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              ))}

              {loading && (
                <div className="message assistant">🧠 Thinking...</div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="composer-wrapper">
              <div className="input-container">
                <textarea
                  value={input}
                  placeholder="Ask something..."
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button onClick={sendMessage} disabled={loading}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
