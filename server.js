const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { GEMINI_API_KEY } = require("./config");
const { summarizeWithGemini } = require("./server/gemini-service");

const PORT = Number(process.env.PORT) || 3000;

const MAX_TEXT_LENGTH = 10000;
const MAX_BODY_SIZE = 64 * 1024;

const MAX_REQUESTS_PER_IP = 20;
const MAX_REQUESTS_PER_DAY = 100;

const HOUR_IN_MS = 60 * 60 * 1000;
const DATA_DIRECTORY = path.join(__dirname, "data");
const USAGE_FILE = path.join(DATA_DIRECTORY, "usage.json");

const VALID_LENGTHS = new Set(["short", "medium", "long"]);
const VALID_FORMATS = new Set(["paragraph", "topics"]);

function sendJson(res, status, data, extraHeaders = {}) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...extraHeaders
    });

    res.end(JSON.stringify(data));
}

function getLocalDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Fortaleza",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

function createUsageData() {
    return {
        date: getLocalDate(),
        totalRequests: 0,
        requestsByIp: {}
    };
}

function loadUsage() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(USAGE_FILE)) {
        return createUsageData();
    }

    const usage = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));

    if (usage.date !== getLocalDate()) {
        return createUsageData();
    }

    if (
        !Number.isInteger(usage.totalRequests) ||
        usage.totalRequests < 0 ||
        !usage.requestsByIp ||
        typeof usage.requestsByIp !== "object"
    ) {
        throw new Error("Arquivo de controle de uso inválido.");
    }

    return usage;
}

function saveUsage(usage) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

function reserveUsage(ip) {
    const usage = loadUsage();
    const now = Date.now();

    if (usage.totalRequests >= MAX_REQUESTS_PER_DAY) {
        return { allowed: false, reason: "daily" };
    }

    const ipHash = crypto
        .createHash("sha256")
        .update(ip)
        .digest("hex");

    const recentRequests = (usage.requestsByIp[ipHash] || [])
        .filter((timestamp) => now - timestamp < HOUR_IN_MS);

    if (recentRequests.length >= MAX_REQUESTS_PER_IP) {
        const retryAfter = Math.ceil(
            (recentRequests[0] + HOUR_IN_MS - now) / 1000
        );

        return {
            allowed: false,
            reason: "ip",
            retryAfter
        };
    }

    recentRequests.push(now);

    usage.requestsByIp[ipHash] = recentRequests;
    usage.totalRequests += 1;

    saveUsage(usage);

    return { allowed: true };
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        let size = 0;
        let tooLarge = false;

        req.on("data", (chunk) => {
            size += chunk.length;

            if (size > MAX_BODY_SIZE) {
                tooLarge = true;

                const error = new Error("Requisição muito grande.");
                error.status = 413;

                reject(error);
                return;
            }

            if (!tooLarge) {
                body += chunk.toString("utf8");
            }
        });

        req.on("end", () => {
            if (tooLarge) return;

            try {
                resolve(JSON.parse(body));
            } catch {
                const error = new Error("Dados enviados em formato inválido.");
                error.status = 400;
                reject(error);
            }
        });

        req.on("error", reject);
    });
}

function isSameOrigin(req) {
    const origin = req.headers.origin;

    if (!origin) return true;

    try {
        return new URL(origin).host === req.headers.host;
    } catch {
        return false;
    }
}

async function handleSummarize(req, res) {
    if (!isSameOrigin(req)) {
        return sendJson(res, 403, {
            message: "Origem da solicitação não permitida."
        });
    }

    if (!req.headers["content-type"]?.includes("application/json")) {
        return sendJson(res, 415, {
            message: "Formato de envio não suportado."
        });
    }

    let data;

    try {
        data = await readJsonBody(req);
    } catch (error) {
        return sendJson(res, error.status || 400, {
            message: error.message || "Não foi possível ler os dados."
        });
    }

    const text = typeof data.text === "string" ? data.text.trim() : "";
    const { length, format } = data;

    if (!text) {
        return sendJson(res, 400, {
            message: "Digite um texto antes de solicitar o resumo."
        });
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return sendJson(res, 400, {
            message: "O texto ultrapassa o limite de 10.000 caracteres."
        });
    }

    if (!VALID_LENGTHS.has(length) || !VALID_FORMATS.has(format)) {
        return sendJson(res, 400, {
            message: "As configurações do resumo são inválidas."
        });
    }

    if (
        !GEMINI_API_KEY ||
        GEMINI_API_KEY === "COLE_SUA_CHAVE_AQUI"
    ) {
        return sendJson(res, 503, {
            message: "A chave da API Gemini não foi configurada no servidor."
        });
    }

    let usage;

    try {
        usage = reserveUsage(req.socket.remoteAddress || "unknown");
    } catch (error) {
        console.error("Erro no controle de uso:", error.message);

        return sendJson(res, 503, {
            message: "Não foi possível verificar o limite de utilização."
        });
    }

    if (!usage.allowed) {
        if (usage.reason === "daily") {
            return sendJson(res, 429, {
                message: "O limite diário do Sintetiza Hub foi atingido. Tente novamente amanhã."
            });
        }

        return sendJson(res, 429, {
            message: `Você atingiu o limite de 5 resumos por hora. Tente novamente em ${Math.ceil(usage.retryAfter / 60)} minuto(s).`
        }, {
            "Retry-After": String(usage.retryAfter)
        });
    }

    try {
        const summary = await summarizeWithGemini(
            { text, length, format },
            GEMINI_API_KEY
        );

        return sendJson(res, 200, { summary });

    } catch (error) {
        console.error("Erro na API Gemini:", {
            status: error.status || "Sem resposta HTTP",
            message: error.message
        });

        if (error.status === 401 || error.status === 403) {
            return sendJson(res, 502, {
                message: "A chave da API Gemini foi recusada. Verifique suas credenciais."
            });
        }

        if (error.status === 429) {
            return sendJson(res, 503, {
                message: "O Gemini atingiu seu limite de solicitações. Tente novamente mais tarde."
            });
        }

        if (error.status === 503) {
            return sendJson(res, 503, {
                message: "O Gemini está com alta demanda no momento. Tente novamente em alguns instantes."
            });
        }

        if (error.status === 504) {
            return sendJson(res, 504, {
                message: "O Gemini demorou demais para responder. Tente novamente."
            });
        }

        return sendJson(res, 502, {
            message: "Não foi possível gerar o resumo. Consulte o terminal do servidor para identificar o erro."
        });
    }
}

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
};

function serveStatic(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(res, 405, {
            message: "Método não permitido."
        });
    }

    let relativePath;

    try {
        relativePath = decodeURIComponent(
            pathname === "/" ? "index.html" : pathname.slice(1)
        );
    } catch {
        return sendJson(res, 400, {
            message: "Endereço inválido."
        });
    }

    const filePath = path.resolve(__dirname, relativePath);
    const allowedPath =
        filePath === path.join(__dirname, "index.html") ||
        filePath.startsWith(path.join(__dirname, "css") + path.sep) ||
        filePath.startsWith(path.join(__dirname, "js") + path.sep);

    if (!allowedPath) {
        return sendJson(res, 404, {
            message: "Arquivo não encontrado."
        });
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            return sendJson(res, 404, {
                message: "Arquivo não encontrado."
            });
        }

        res.writeHead(200, {
            "Content-Type": mimeTypes[path.extname(filePath)],
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        });

        res.end(req.method === "HEAD" ? undefined : content);
    });
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/summarize") {
        if (req.method !== "POST") {
            return sendJson(res, 405, {
                message: "Método não permitido."
            });
        }

        return handleSummarize(req, res);
    }

    if (requestUrl.pathname.startsWith("/api/")) {
        return sendJson(res, 404, {
            message: "Endpoint não encontrado."
        });
    }

    serveStatic(req, res, requestUrl.pathname);
});

server.listen(PORT, () => {
    console.log(`Sintetiza Hub disponível em http://localhost:${PORT}`);
});
