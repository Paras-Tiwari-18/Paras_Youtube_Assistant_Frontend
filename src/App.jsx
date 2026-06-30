import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { YoutubeTranscript } from "youtube-transcript";
import "katex/dist/katex.min.css";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://paras-tiwari-18-you-tube-project.hf.space/api/chat";

function createSessionId() {
  return "chat-" + crypto.randomUUID();
}

function beautifyMarkdown(text) {
  if (!text) return "";
  return text.replace(/\n{3,}/g, "\n\n").replace(/â€¢/g, "-").trim();
}

function extractVideoId(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }

    if (
      parsed.hostname.includes("youtube.com") &&
      parsed.searchParams.has("v")
    ) {
      return parsed.searchParams.get("v");
    }

    return null;
  } catch {
    return null;
  }
}

async function getTranscript(url) {
  try {
    const videoId = extractVideoId(url);
    console.log("VIDEO ID:", videoId);

    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    console.log("RAW TRANSCRIPT:", transcript);

    if (!transcript || transcript.length === 0) {
      throw new Error("Transcript empty");
    }

    const text = transcript.map((item) => item.text).join(" ");

    console.log("TRANSCRIPT LENGTH:", text.length);

    return text;
  } catch (err) {
    console.error("TRANSCRIPT ERROR:", err);
    throw err;
  }
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
      transcript: "",
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

      console.log("STEP 1: fetching transcript...");
      const transcript = await getTranscript(url);

      if (!transcript || transcript.trim().length === 0) {
        throw new Error("Transcript missing");
      }

      const payload = {
        session_id: activeChat.id,
        message: "__load_video__",
        transcript,
      };

      console.log("PAYLOAD:", payload);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      console.log("BACKEND RESPONSE:", raw);

      if (!res.ok) {
        throw new Error(raw);
      }

      updateChat({
        youtubeUrl: url,
        transcript,
        messages: [
          ...activeChat.messages,
          {
            role: "assistant",
            content:
              "✅ **Video loaded successfully!**\n\nYou can now ask questions related to the video.",
          },
        ],
      });
    } catch (err) {
      console.error("FULL ERROR:", err);

      updateChat({
        messages: [
          ...activeChat.messages,
          {
            role: "assistant",
            content: `❌ ${err.message}`,
          },
        ],
      });
    } finally {
      setVideoLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeChat) return;

    const userMessage = {
      role: "user",
      content: input,
    };

    updateChat({
      messages: [...activeChat.messages, userMessage],
    });

    setInput("");
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: activeChat.id,
          message: input,
          transcript: activeChat.transcript,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Backend error");
      }

      updateChat({
        messages: [
          ...activeChat.messages,
          userMessage,
          {
            role: "assistant",
            content: beautifyMarkdown(data.reply),
          },
        ],
      });

      if (activeChat.title === "New Chat") {
        updateChat({
          title: input.slice(0, 40),
        });
      }
    } catch (err) {
      console.error(err);

      updateChat({
        messages: [
          ...activeChat.messages,
          userMessage,
          {
            role: "assistant",
            content: `⚠️ ${err.message}`,
          },
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
            className={`chat-item ${
              chat.id === activeChatId ? "active" : ""
            }`}
          >
            <span onClick={() => setActiveChatId(chat.id)}>
              {chat.title}
            </span>

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
                onChange={(e) =>
                  updateChat({ youtubeUrl: e.target.value })
                }
              />

              <button
                onClick={() => loadVideo(activeChat.youtubeUrl)}
                disabled={videoLoading}
              >
                {videoLoading ? "Loading..." : "Load Video"}
              </button>
            </div>

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
                <div className="message assistant">
                  🧠 Thinking...
                </div>
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