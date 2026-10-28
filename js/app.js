const summaryForm = document.querySelector("#summary-form");
const sourceText = document.querySelector("#source-text");
const characterCount = document.querySelector("#character-count");
const statusMessage = document.querySelector("#status-message");
const textareaWrapper = document.querySelector(".textarea-wrapper");

const optionInputs = document.querySelectorAll(
    'input[name="summary-length"], input[name="summary-format"]'
);

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
    const selectedLength = document.querySelector(
        'input[name="summary-length"]:checked'
    ).value;

    const selectedFormat = document.querySelector(
        'input[name="summary-format"]:checked'
    ).value;

    const lengthLabels = {
        short: "Curto",
        medium: "Médio",
        long: "Detalhado"
    };

    const formatLabels = {
        paragraph: "Texto corrido",
        topics: "Tópicos"
    };

    return {
        length: selectedLength,
        format: selectedFormat,
        lengthLabel: lengthLabels[selectedLength],
        formatLabel: formatLabels[selectedFormat]
    };
}

sourceText.addEventListener("input", () => {
    updateCharacterCount();
    clearValidation();
});

optionInputs.forEach((input) => {
    input.addEventListener("change", clearValidation);
});

summaryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = sourceText.value.trim();

    if (!text) {
        showStatus("Digite um texto antes de continuar.", true);
        sourceText.setAttribute("aria-invalid", "true");
        textareaWrapper.classList.add("has-error");
        sourceText.focus();
        return;
    }

    const settings = getSummarySettings();

    showStatus(
        `Texto válido · ${settings.lengthLabel} · ${settings.formatLabel}.`
    );

    console.log("Configurações selecionadas:", {
        length: settings.length,
        format: settings.format
    });
});

updateCharacterCount();
