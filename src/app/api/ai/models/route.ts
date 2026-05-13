// Debug endpoint — lists the Gemini models actually available with our API key.
// Helps diagnose "model not found" errors caused by region/account differences.

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY is missing" }),
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    const data = await res.json();

    // Filter to text-generation models with their short names
    const models = (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string; displayName: string }) => ({
        name: m.name.replace(/^models\//, ""),
        displayName: m.displayName,
      }));

    return new Response(JSON.stringify(models, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500 },
    );
  }
}
