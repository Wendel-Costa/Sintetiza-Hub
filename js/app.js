import { summarizeWithGemini } from "./gemini.js";

const summaryForm = document.querySelector("#summary-form");
const sourceText = document.querySelector("#source-text");
const characterCount = document.querySelector("#character-count");
const statusMessage = document.querySelector("#status-message");
const textareaWrapper = document.querySelector(".textarea-wrapper");
const summaryButton = document.querySelector("#summarize-button");
const summaryText = document.querySelector("#summary-text");
const resultPlaceholder = document.querySelector("#result-placeholder");
const placeholderMessage = resultPlaceholder.querySelector("p");

const optionInputs = document.querySelectorAll(
    'input[name="summary-length"], input[name="summary-format"]'
);

const initialPlaceholder = placeholderMessage.textContent;

function updateCharacterCount() {
    characterCount.textContent = sourceText.value.length.toLocaleString("pt-BR");
}

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("is-error", isError);
}

function clearValidation() {
    showStatus("");
    sourceText.setAttribute("aria-invalid", "false");
    textareaWrapper.classList.remove("has-error");
}

function getSummarySettings() {
    const length = document.querySelector(
        'input[name="summary-length"]:checked'
    ).value;

    const format = document.querySelector(
        'input[name="summary-format"]:checked'
    ).value;

    return { length, format };
}

function setLoading(isLoading) {
    summaryButton.disabled = isLoading;
    summaryButton.textContent = isLoading
        ? "Gerando resumo..."
        : "Gerar resumo →";
}

function appendInlineMarkdown(container, text) {
    const pattern =
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(?!\s)(.+?)\*|_(?!\s)(.+?)_/g;

    let lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
        const precedingText = text.slice(lastIndex, match.index);

        if (precedingText) {
            container.appendChild(document.createTextNode(precedingText));
        }

        if (match[1] && match[2]) {
            try {
                const url = new URL(match[2]);

                if (url.protocol === "http:" || url.protocol === "https:") {
                    const link = document.createElement("a");
                    link.href = url.href;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = match[1];

                    container.appendChild(link);
                } else {
                    container.appendChild(document.createTextNode(match[0]));
                }
            } catch {
                container.appendChild(document.createTextNode(match[0]));
            }
        } else if (match[3] || match[4]) {
            const strong = document.createElement("strong");
            strong.textContent = match[3] || match[4];
            container.appendChild(strong);
        } else if (match[5]) {
            const code = document.createElement("code");
            code.textContent = match[5];
            container.appendChild(code);
        } else if (match[6] || match[7]) {
            const emphasis = document.createElement("em");
            emphasis.textContent = match[6] || match[7];
            container.appendChild(emphasis);
        }

        lastIndex = match.index + match[0].length;
    }

    const remainingText = text.slice(lastIndex);

    if (remainingText) {
        container.appendChild(document.createTextNode(remainingText));
    }
}

function renderSummary(markdown) {
    const normalizedMarkdown = String(markdown)
        .replace(/\\([*_`>#.+-])/g, "$1")
        .trim();

    const lines = normalizedMarkdown.split(/\r?\n/);

    summaryText.replaceChildren();

    let paragraphLines = [];
    let currentList = null;
    let currentListType = null;

    function flushParagraph() {
        if (paragraphLines.length === 0) return;

        const paragraph = document.createElement("p");
        appendInlineMarkdown(paragraph, paragraphLines.join(" "));
        summaryText.appendChild(paragraph);

        paragraphLines = [];
    }

    function flushList() {
        currentList = null;
        currentListType = null;
    }

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = trimmedLine.match(/^#{1,3}\s+(.+)$/);

        if (heading) {
            flushParagraph();
            flushList();

            const title = document.createElement("h3");
            appendInlineMarkdown(title, heading[1]);
            summaryText.appendChild(title);

            continue;
        }

        if (/^---+$/.test(trimmedLine)) {
            flushParagraph();
            flushList();
            summaryText.appendChild(document.createElement("hr"));
            continue;
        }

        const unorderedItem = trimmedLine.match(/^[-*+]\s+(.+)$/);
        const orderedItem = trimmedLine.match(/^\d+[.)]\s+(.+)$/);

        if (unorderedItem || orderedItem) {
            flushParagraph();

            const listType = unorderedItem ? "ul" : "ol";

            if (currentListType !== listType) {
                flushList();

                currentList = document.createElement(listType);
                currentListType = listType;

                summaryText.appendChild(currentList);
            }

            const item = document.createElement("li");
            appendInlineMarkdown(
                item,
                unorderedItem ? unorderedItem[1] : orderedItem[1]
            );

            currentList.appendChild(item);
            continue;
        }

        flushList();
        paragraphLines.push(trimmedLine);
    }

    flushParagraph();
    flushList();
}

sourceText.addEventListener("input", () => {
    updateCharacterCount();
    clearValidation();
});

optionInputs.forEach((input) => {
    input.addEventListener("change", clearValidation);
});

summaryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = sourceText.value.trim();

    if (!text) {
        showStatus("Digite um texto antes de continuar.", true);
        sourceText.setAttribute("aria-invalid", "true");
        textareaWrapper.classList.add("has-error");
        sourceText.focus();
        return;
    }

    clearValidation();

    const settings = getSummarySettings();

    setLoading(true);

    summaryText.hidden = true;
    resultPlaceholder.hidden = false;
    placeholderMessage.textContent = "Gerando seu resumo...";

    showStatus("Processando solicitação...");

    try {
        const summary = await summarizeWithGemini({
            text,
            ...settings
        });

        renderSummary(summary);

        summaryText.hidden = false;
        resultPlaceholder.hidden = true;

        showStatus("");

    } catch (error) {
        placeholderMessage.textContent = initialPlaceholder;
        showStatus(error.message, true);

    } finally {
        setLoading(false);
    }
});

updateCharacterCount();