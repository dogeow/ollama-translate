export async function generateOllamaResponse(base, model, prompt) {
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new Error(
        "HTTP 403：Ollama 拒绝了扩展的请求。请在终端用以下命令启动 Ollama 后再试：\n\nollama serve",
      );
    }
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.response || "").trim();
}

export async function checkOllamaAndGetModels(ollamaUrl) {
  const base = ollamaUrl.replace(/\/$/, "");
  const tagsUrl = `${base}/api/tags`;

  try {
    const response = await fetch(tagsUrl);
    if (response.status === 403) {
      return { error: "403" };
    }
    if (!response.ok) {
      return { error: "connection" };
    }
    const data = await response.json();
    return { models: data.models || [] };
  } catch (_) {
    return { error: "connection" };
  }
}
