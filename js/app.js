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

        summaryText.textContent = summary;
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
