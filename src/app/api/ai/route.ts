import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PulseMeet AI: "Catch Me Up" summaries and Smart Reply suggestions.
//
// Two modes, picked automatically:
//   • With ANTHROPIC_API_KEY set → Claude (best quality).
//   • Without a key (or if Claude errors) → a FREE local fallback that needs no
//     API and no signup. Lower quality, but instant and always available.
const MODEL = "claude-opus-4-8";

type Msg = { content: string; sender: { id: string; name: string } };

// ---- Free, no-API fallbacks -------------------------------------------------

function localCatchup(messages: Msg[], meId: string): string {
  const fromOthers = messages.filter((m) => m.sender.id !== meId);
  const names = Array.from(new Set(fromOthers.map((m) => m.sender.name)));
  const lines: string[] = [];

  if (fromOthers.length === 0) {
    lines.push("• No new messages from others — you sent the latest.");
  } else {
    lines.push(
      `• ${fromOthers.length} recent message${fromOthers.length > 1 ? "s" : ""} from ${names.join(", ")}.`,
    );
  }

  const questions = fromOthers.filter((m) => m.content.trim().endsWith("?")).slice(-2);
  for (const q of questions) {
    const c = q.content.trim();
    lines.push(`• ${q.sender.name} asked: "${c.length > 90 ? c.slice(0, 90) + "…" : c}"`);
  }

  const last = messages.slice(-4);
  if (last.length) {
    lines.push("• Latest:");
    for (const m of last) {
      const who = m.sender.id === meId ? "You" : m.sender.name;
      const c = (m.content || "[attachment]").replace(/\s+/g, " ").trim();
      lines.push(`   – ${who}: ${c.length > 80 ? c.slice(0, 80) + "…" : c}`);
    }
  }
  return lines.join("\n");
}

function localReplies(messages: Msg[], meId: string): string[] {
  const lastIncoming = [...messages].reverse().find((m) => m.sender.id !== meId);
  const text = (lastIncoming?.content ?? "").toLowerCase().trim();

  if (!lastIncoming || text.length === 0) return ["Hey! 👋", "What's up?", "How's it going?"];
  if (text.endsWith("?"))
    return ["Yes, sounds good 👍", "Let me check and get back to you", "Could you clarify a bit?"];
  if (/(thank|thanks|thx|appreciate)/.test(text)) return ["You're welcome! 😊", "Anytime!", "No problem 🙌"];
  if (/\b(hi|hello|hey|good morning|good evening|salam|assalamu)\b/.test(text))
    return ["Hey! 👋", "Hello! How are you?", "Hi there 🙂"];
  if (/(ok|okay|sure|got it|sounds good|alright|fine)/.test(text)) return ["👍", "Great!", "Perfect, thanks!"];
  if (/(sorry|apolog)/.test(text)) return ["No worries!", "It's all good 🙂", "Don't worry about it"];
  if (/(bye|see you|good night|gn|ttyl)/.test(text)) return ["Talk soon! 👋", "See you!", "Good night 🌙"];
  return ["Got it 👍", "Sounds good!", "Let me think about that"];
}

// ----------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { conversationId, action } = body;
  if (!conversationId || (action !== "catchup" && action !== "replies")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Not a member of this conversation" }, { status: 403 });
  }

  // Most recent 40 non-deleted messages, oldest-first for a readable transcript.
  const rows = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      content: true,
      sender: { select: { id: true, name: true } },
    },
  });
  const messages: Msg[] = rows.reverse();
  if (messages.length === 0) {
    return NextResponse.json({ error: "There are no messages to work with yet" }, { status: 400 });
  }

  const meId = session.user.id;
  const me = session.user.name ?? "Me";

  // Premium path: use Claude when a key is configured. Any failure falls back
  // to the free local mode below rather than erroring out.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const transcript = messages
        .map((m) => `${m.sender.id === meId ? `${me} (me)` : m.sender.name}: ${m.content || "[attachment]"}`)
        .join("\n");

      if (action === "catchup") {
        const resp = await client.messages.create({
          model: MODEL,
          max_tokens: 500,
          output_config: { effort: "low" },
          system:
            "You help someone catch up on a chat they may have missed. Summarize the conversation into a concise TL;DR: 2–4 short bullet points covering what was discussed, any decisions, and anything awaiting a reply. Refer to people by name. Respond ONLY with the bullet summary — no preamble, no headers, no meta-commentary.",
          messages: [{ role: "user", content: `Conversation:\n\n${transcript}` }],
        });
        let summary = "";
        for (const block of resp.content) if (block.type === "text") summary += block.text;
        return NextResponse.json({ summary: summary.trim(), mode: "ai" });
      }

      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 320,
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { replies: { type: "array", items: { type: "string" } } },
              required: ["replies"],
              additionalProperties: false,
            },
          },
        },
        system: `You suggest short replies that "${me}" could send next in this chat. Produce 3 distinct, natural, ready-to-send replies written in the first person as ${me} — each under ~12 words, varied in tone. No quotation marks, no numbering.`,
        messages: [
          { role: "user", content: `Conversation:\n\n${transcript}\n\nSuggest 3 replies for ${me} to send next.` },
        ],
      });
      let text = "";
      for (const block of resp.content) if (block.type === "text") text += block.text;
      const parsed = JSON.parse(text) as { replies?: unknown };
      const replies = Array.isArray(parsed.replies)
        ? parsed.replies.filter((r): r is string => typeof r === "string").slice(0, 3)
        : [];
      if (replies.length) return NextResponse.json({ replies, mode: "ai" });
      // empty result → fall through to local
    } catch (err) {
      console.error("AI route (Claude) error, using free fallback:", err);
    }
  }

  // Free local mode — no API key required.
  if (action === "catchup") {
    return NextResponse.json({ summary: localCatchup(messages, meId), mode: "local" });
  }
  return NextResponse.json({ replies: localReplies(messages, meId), mode: "local" });
}
