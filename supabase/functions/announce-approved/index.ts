import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const QWICKY_CHANNEL_ID = "1467942158135853218";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  const expectedKey = Deno.env.get("ANNOUNCE_WEBHOOK_KEY");
  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { content?: unknown; channelId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { content, channelId } = body;
  if (!content || typeof content !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid 'content' field" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (content.length > 2000) {
    return new Response(
      JSON.stringify({ error: "Content exceeds 2000 character limit" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("discord_notifications")
    .insert({
      notification_type: "announcement",
      channel_id: channelId || QWICKY_CHANNEL_ID,
      tournament_id: "__announcement__",
      payload: { content },
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, notificationId: data.id }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
