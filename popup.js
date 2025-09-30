document.getElementById("summarise").addEventListener("click", () => {
    const result = document.getElementById("summary");
    const summaryType = document.getElementById("summary-type").value;

    // Show loading
    result.innerHTML = '<div class="loader">Summarising...</div>';

    // Get user's API key
    chrome.storage.sync.get(["geminiApiKey"], ({ geminiApiKey }) => {
        if (!geminiApiKey) {
            result.textContent = "No API key set. Click gear icon to add one";
            return;
        }

        // Ask content.js for page text
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            chrome.tabs.sendMessage(tab.id, { action: "getArticleText" }, async ({ articleText }) => {
                if (!articleText) {
                    result.textContent = "Couldn't extract text from this page";
                    return;
                }

                try {
                    const summary = await getGeminiSummary(articleText, summaryType, geminiApiKey);
                    result.textContent = summary;
                } catch (error) {
                    result.textContent = "Gemini error: " + error.message;
                }
            });
        });
    });
});

async function getGeminiSummary(rawtext, type, apiKey) {
    const max = 20000;
    const text = rawtext.length > max ? rawtext.slice(0, max) + "..." : rawtext;

    const promptMap = {
        brief: `Summarise in 3-4 sentences:\n${text}`,
        detailed: `Give a detailed summary:\n\n${text}`
    };

    const prompt = promptMap[type] || promptMap.brief;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
        })
    });

    if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error?.message || "Request failed");
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary";
}
