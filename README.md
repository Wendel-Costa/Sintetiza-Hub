
# Sintetiza Hub

Aplicação web para geração de resumos de textos utilizando inteligência artificial através da API Gemini.

## Funcionalidades

- Inserção de textos de até 10.000 caracteres.
- Geração de resumos em três níveis: curto, médio e detalhado.
- Escolha entre texto corrido e tópicos.
- Formatação automática do resultado.
- Opção para copiar o resumo gerado.
- Contador de caracteres.
- Controle de utilização para limitar solicitações à API.

## Tecnologias utilizadas

**Frontend**
- HTML5
- CSS3
- JavaScript (ES Modules)

**Backend**
- Node.js
- API Google Gemini

## Estrutura do projeto

```text
sintetiza-hub/
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── gemini.js
├── server/
│   └── gemini-service.js
├── data/
│   └── usage.json
├── index.html
├── server.js
├── config.example.js
├── config.js
└── .gitignore
```

O arquivo `data/usage.json` é criado automaticamente pelo servidor para armazenar os registros de utilização.

O arquivo `config.js` contém a chave de acesso à API e não deve ser enviado ao repositório.

## Configuração e execução

### 1. Requisitos

- Node.js 18 ou superior.
- Uma chave de API do Google Gemini.

### 2. Configurar a chave da API

Na raiz do projeto, copie o arquivo de exemplo:

```bash
cp config.example.js config.js
```

Abra o arquivo `config.js` e insira sua chave:

```javascript
module.exports = {
    GEMINI_API_KEY: "SUA_CHAVE_AQUI"
};
```

Nunca compartilhe ou envie sua chave de API ao GitHub.

### 3. Executar a aplicação

Inicie o servidor:

```bash
node server.js
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

No GitHub Codespaces, acesse a aplicação pela porta 3000 na aba Ports.

## Controle de utilização

O servidor possui limites para reduzir o consumo indevido da API:

| Restrição | Limite |
|---|---:|
| Solicitações por IP | 15 por hora |
| Solicitações globais | 100 por dia |
| Tamanho máximo do texto | 10.000 caracteres |

Os limites podem ser ajustados diretamente no arquivo `server.js`.

Além disso, a utilização está sujeita às cotas e condições estabelecidas pelo Google Gemini.

## Segurança

- A chave da API é armazenada no backend.
- As solicitações ao Gemini são realizadas pelo servidor.
- Existe validação dos dados recebidos.
- O servidor controla a quantidade de solicitações.
- Arquivos de configuração com credenciais não devem ser versionados.

## Autor

**Wendel Costa**

GitHub: [@Wendel-Costa](https://github.com/Wendel-Costa)

---

Sintetiza Hub © 2026
