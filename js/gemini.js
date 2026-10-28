
export async function summarizeWithGemini({ text, length, format }) {
    let response;

    try {
        response = await fetch("/api/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text, length, format })
        });
    } catch {
        throw new Error("Não foi possível conectar ao servidor.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Não foi possível gerar o resumo.");
    }

    return data.summary;
}
