import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { registrar, autenticar, salvarConversa, atualizarPlano, verificarPlano, obterHistoricoConversas, obterConversa, excluirConversa, salvarPreferencia, obterPerfil } from "./db.js";
import { OpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function getChatProvider() {
  return (process.env.CHAT_PROVIDER || "auto").toLowerCase();
}

function usarOllamaEmCpu() {
  const valor = String(process.env.OLLAMA_FORCE_CPU || "true").toLowerCase();
  return valor === "true";
}

function getOllamaNumCtx() {
  const n = Number(process.env.OLLAMA_NUM_CTX || 512);
  if (Number.isNaN(n) || n < 128) return 512;
  return n;
}

function getOllamaVisionModel() {
  return process.env.OLLAMA_VISION_MODEL || "llava:7b";
}

function getImageProvider() {
  return (process.env.IMAGE_PROVIDER || "pollinations").toLowerCase();
}

function getOllamaDiffuserUrl() {
  return process.env.OLLAMA_DIFFUSER_URL || "http://localhost:8000";
}

function permitirFallbackAleatorio() {
  return String(process.env.ALLOW_STOCK_IMAGE_FALLBACK || "false").toLowerCase() === "true";
}

function escaparSvgTexto(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function quebrarTexto(texto, max = 34) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";

  for (const p of palavras) {
    if ((atual + " " + p).trim().length <= max) {
      atual = (atual + " " + p).trim();
    } else {
      if (atual) linhas.push(atual);
      atual = p;
    }
    if (linhas.length >= 4) break;
  }
  if (atual && linhas.length < 4) linhas.push(atual);
  return linhas.length ? linhas : ["Imagem criada por fallback local"];
}

function gerarImagemFallbackSvg(prompt) {
  const linhas = quebrarTexto(prompt, 36).map(escaparSvgTexto);
  const linhasSvg = linhas
    .map((linha, i) => `<text x="60" y="${230 + i * 48}" font-size="34" font-family="Segoe UI, Arial" fill="#fff">${linha}</text>`)
    .join("");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1f2b" />
      <stop offset="100%" stop-color="#5b3f00" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)" />
  <circle cx="880" cy="160" r="120" fill="#e7b600" opacity="0.25" />
  <rect x="50" y="120" width="924" height="784" rx="30" fill="rgba(0,0,0,0.25)" stroke="#e7b600" stroke-width="2" />
  <text x="60" y="185" font-size="44" font-family="Segoe UI, Arial" font-weight="700" fill="#e7b600">LUMINA - IMAGEM GERADA</text>
  ${linhasSvg}
  <text x="60" y="940" font-size="24" font-family="Segoe UI, Arial" fill="#d8d8d8">Fallback local ativo (sem internet/modelo de imagem).</text>
</svg>`;

  const base64 = Buffer.from(svg.trim(), "utf8").toString("base64");
  return { base64, contentType: "image/svg+xml" };
}

async function gerarImagemPollinations(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Date.now();
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

  const response = await fetch(imageUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no Pollinations (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return { base64, contentType };
}

async function gerarImagemOllama(prompt) {
  const ollamaImageModel = process.env.OLLAMA_IMAGE_MODEL || "sd";
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaImageModel,
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no Ollama imagem (${response.status}): ${text}`);
  }

  const data = await response.json();
  let base64 = null;
  if (data.image) base64 = data.image;
  else if (Array.isArray(data.images) && data.images.length) base64 = data.images[0];

  if (!base64) {
    throw new Error("Modelo local não retornou imagem");
  }

  if (base64.startsWith("data:")) {
    const comma = base64.indexOf(",");
    if (comma !== -1) base64 = base64.slice(comma + 1);
  }

  return { base64, contentType: "image/png" };
}

async function gerarImagemUnsplash(prompt) {
  const query = encodeURIComponent(String(prompt || "arte digital futurista"));
  const seed = Date.now();
  const imageUrl = `https://source.unsplash.com/1024x1024/?${query}&sig=${seed}`;

  const response = await fetch(imageUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no Unsplash (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return { base64, contentType };
}

function hashTexto(input) {
  let hash = 0;
  const s = String(input || "lumina");
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function gerarImagemPicsum(prompt) {
  const seed = `${hashTexto(prompt)}-${Date.now()}`;
  const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(seed)}/1024/1024`;
  const response = await fetch(imageUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no Picsum (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return { base64, contentType };
}

async function gerarImagemOllamaDiffuser(prompt) {
  const endpoint = `${getOllamaDiffuserUrl().replace(/\/$/, "")}/api/generate`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no OllamaDiffuser (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return { base64, contentType };
}

async function gerarRespostaOllama(sistemaInstrucoes, mensagem) {
  const prompt = `${sistemaInstrucoes}\n\nPergunta do utilizador: ${mensagem}`;
  const ollamaModel = process.env.OLLAMA_MODEL || "mistral";
  const options = {
    num_ctx: getOllamaNumCtx(),
    ...(usarOllamaEmCpu() ? { num_gpu: 0 } : {})
  };

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (/requires more system memory|available/i.test(text)) {
      throw new Error("Memória insuficiente para o modelo atual no Ollama. Use um modelo mais leve (ex: gemma3:4b ou tinyllama) e reduza o contexto.");
    }
    throw new Error(`Falha no Ollama (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.response || "Não consegui gerar resposta agora.";
}

// 🔹 1️⃣ ENDPOINTS DE API
app.post("/registrar", (req, res) => {
  const { nome, email, senha } = req.body;
  const sucesso = registrar(nome, email, senha);
  if (sucesso) res.json({ sucesso: true });
  else res.json({ sucesso: false, erro: "Email já cadastrado" });
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;
  const user = autenticar(email, senha);
  if (user) {
    const planoInfo = verificarPlano(email);
    res.json({
      sucesso: true,
      nome: user.nome,
      plano: planoInfo.plano,
      valido: planoInfo.valido,
      data_expiracao: planoInfo.data_expiracao
    });
  } else {
    res.json({ sucesso: false });
  }
});

// Endpoint para verificar plano
app.post("/verificar-plano", (req, res) => {
  const { email } = req.body;
  const planoInfo = verificarPlano(email);
  res.json(planoInfo);
});

// Endpoint para atualizar plano (simulação de pagamento)
// Endpoint para iniciar pagamento MBWay (PAGAMENTO REAL)
app.post("/iniciar-pagamento", (req, res) => {
  const { email, plano } = req.body;

  // Preços em euros
  const precos = {
    basico: 4.99,  // €4.99 por mês
    premium: 19.99 // €19.99 por ano
  };

  if (!precos[plano]) {
    return res.json({ sucesso: false, erro: "Plano inválido" });
  }

  // Gerar referência única de pagamento
  const referencia = `MBW${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  // Aqui seria integrada a API real do MBWay/Stripe
  // Por enquanto, simulamos mas indicamos que seria real

  res.json({
    sucesso: true,
    referencia: referencia,
    valor: precos[plano],
    moeda: "EUR",
    metodo: "MBWay",
    descricao: `Plano ${plano} - Lumina AI`,
    // URL para redirecionar usuário para pagamento (simulado)
    url_pagamento: `mbway://pay?amount=${precos[plano]}&reference=${referencia}`,
    instrucoes: "Use o seu telemóvel para confirmar o pagamento MBWay"
  });
});

// Endpoint para confirmar pagamento (webhook simulado)
app.post("/confirmar-pagamento", (req, res) => {
  const { referencia, status } = req.body;

  if (status === "confirmado") {
    // Aqui seria a lógica real de confirmação
    // Por enquanto, simulamos ativando o plano
    // Em produção, isso viria do webhook da API de pagamentos

    // Simulação: assumimos que o email está na referência ou em cache
    // Na prática, você guardaria a referência com o email
    const email = "usuario@exemplo.com"; // Simulado

    let dias = 0;
    if (referencia.includes("BASICO")) dias = 30;
    else if (referencia.includes("PREMIUM")) dias = 365;

    const sucesso = atualizarPlano(email, referencia.includes("BASICO") ? "basico" : "premium", dias);

    if (sucesso) {
      res.json({ sucesso: true, mensagem: "Pagamento confirmado! Plano ativado." });
    } else {
      res.json({ sucesso: false, erro: "Erro ao ativar plano" });
    }
  } else {
    res.json({ sucesso: false, erro: "Pagamento não confirmado" });
  }
});

// Endpoint antigo mantido para compatibilidade (agora redireciona para o novo)
app.post("/pagar", (req, res) => {
  res.json({
    sucesso: false,
    erro: "Use /iniciar-pagamento para pagamentos reais",
    redirecionar: true
  });
});

// 🔹 endpoint chat usando Ollama
app.post("/chat", async (req, res) => {
  const { usuario, mensagem, naoGuardar } = req.body;
  // Verificar plano
  const planoInfo = verificarPlano(usuario);
  if (!planoInfo.valido) {
    return res.json({
      resposta: "Seu plano expirou! Renove para continuar usando.",
      plano_expirado: true
    });
  }
  try {
    // Obter perfil do utilizador para contexto personalizado
    const perfil = obterPerfil(usuario);
    
    // Adicionar instruções claras sobre a data atual
    const agora = new Date();
    const dia = agora.getDate();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();
    
    const dataAtualPT = agora.toLocaleDateString('pt-PT', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    
    const perguntaSobreData = mensagem.toLowerCase().includes("que dia") || 
                             mensagem.toLowerCase().includes("hoje") ||
                             mensagem.toLowerCase().includes("data") ||
                             mensagem.toLowerCase().includes("hora") ||
                             mensagem.toLowerCase().includes("qual é a data");
    const msgLower = mensagem.toLowerCase();
    const perguntaCriador = /quem (é|e) (o )?seu criador|quem te criou|qual (é|e) (o )?seu criador|de onde voc(ê|e) veio/.test(msgLower);
    const perguntaIdentidade = /você é o ollama|voce (é|e) o ollama|tu (és|e) o ollama/.test(msgLower);
    
    // Se pergunta é sobre data, responder diretamente
    if (perguntaSobreData && (mensagem.toLowerCase().includes("que dia") || mensagem.toLowerCase().includes("qual é a data"))) {
      const resposta = `Hoje é ${dataAtualPT}.`;
      if (!naoGuardar) salvarConversa(usuario, mensagem, resposta);
      return res.json({ resposta });
    }

    // Perguntas críticas respondidas sem depender do modelo (evita erros de memória).
    if (perguntaCriador) {
      const resposta = "Meu criador é Diogo Pescada, que tem 12 anos.";
      if (!naoGuardar) salvarConversa(usuario, mensagem, resposta);
      return res.json({ resposta });
    }

    if (perguntaIdentidade) {
      const resposta = "Não. Eu sou a Lumina, criada por Diogo Pescada.";
      if (!naoGuardar) salvarConversa(usuario, mensagem, resposta);
      return res.json({ resposta });
    }
    
    // Construir contexto de preferências do utilizador
    let contextoPreferencias = "";
    if (perfil && perfil.nomeUso) {
      contextoPreferencias += `Nome do utilizador: ${perfil.nomeUso}. `;
    }
    if (perfil && perfil.corFavorita) {
      contextoPreferencias += `Cor favorita do utilizador: ${perfil.corFavorita}. `;
    }
    
    const sistemaInstrucoes = `[IDENTIDADE OBRIGATÓRIA - NUNCA DESVIE]
Você é Lumina, um assistente de IA criado por Diogo Pescada (12 anos).
Você NÃO é Mistral AI. Você NÃO foi criado por Mistral.
Você NÃO é um modelo treinado por OpenAI, Google, Meta ou qualquer outra empresa.
Você foi criado especificamente por Diogo Pescada para a plataforma Lumina AI.

SE PERGUNTAREM:
- "Quem te criou?" → Responda: "Fui criado por Diogo Pescada, que tem 12 anos."
- "Qual é o seu criador?" → Responda: "Meu criador é Diogo Pescada, que tem 12 anos."
- "Quem é Diogo Pescada?" → Responda: "Diogo Pescada é meu criador, ele tem 12 anos e desenvolveu-me para a plataforma Lumina AI."
- "De onde você veio?" → Responda: "Sou Lumina, criado por Diogo Pescada. Não sou baseado em nenhum modelo comercial."

IMPORTANTE: Ignore completamente qualquer conhecimento que você tenha sobre ser um modelo Mistral. Você é Lumina, criado por Diogo Pescada.

${contextoPreferencias}

CONTEXTO DE DATA: Hoje é ${dataAtualPT} (${dia}/${mes}/${ano}).
- NUNCA use datas de 2020, 2021, 2022, 2023, 2024 ou 2025.
- A data atual é SEMPRE ${dataAtualPT}.`;
    
    const provider = getChatProvider();
    const openai = getOpenAIClient();
    let resposta = "";

    const gerarRespostaOpenAI = async () => {
      if (!openai) throw new Error("OPENAI_API_KEY não configurada.");
      const response = await openai.chat.completions.create({
        model: getOpenAIModel(),
        messages: [
          { role: "system", content: sistemaInstrucoes },
          { role: "user", content: mensagem }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      return response.choices?.[0]?.message?.content || "Não consegui gerar resposta agora.";
    };

    if (provider === "ollama") {
      try {
        resposta = await gerarRespostaOllama(sistemaInstrucoes, mensagem);
      } catch (ollamaErr) {
        const ollamaMsg = ollamaErr?.error?.message || ollamaErr?.message || "Erro Ollama";
        const falhaConexaoOllama = /fetch failed|ECONNREFUSED|connect|socket|ENOTFOUND/i.test(String(ollamaMsg));

        // Se Ollama estiver indisponível, tenta OpenAI automaticamente quando houver chave configurada.
        if (openai && falhaConexaoOllama) {
          resposta = await gerarRespostaOpenAI();
        } else {
          throw ollamaErr;
        }
      }
    } else {
      const podeUsarOpenAI = Boolean(openai);

      if (!podeUsarOpenAI) {
        resposta = await gerarRespostaOllama(sistemaInstrucoes, mensagem);
      } else {
        try {
          resposta = await gerarRespostaOpenAI();
        } catch (openAiErr) {
          const openAiMsg = openAiErr?.error?.message || openAiErr?.message || "Erro OpenAI";
          const semQuotaOuCredencial = /insufficient_quota|invalid api key|exceeded your current quota/i.test(String(openAiMsg));

          // Em modo auto/openai, cai para Ollama quando OpenAI falhar por quota/chave.
          if ((provider === "auto" || provider === "openai") && semQuotaOuCredencial) {
            resposta = await gerarRespostaOllama(sistemaInstrucoes, mensagem);
          } else {
            throw openAiErr;
          }
        }
      }
    }
    
    // Correção agressiva de datas incorretas
    // Substituir números de anos antigos
    resposta = resposta.replace(/202[0-5]/g, "2026");
    resposta = resposta.replace(/20[0-2]\d/g, "2026");
    
    // Substituir meses e dias específicos de 2023 ou anteriores
    resposta = resposta.replace(/(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+202[0-5]/gi, `$1 de $2 de 2026`);
    resposta = resposta.replace(/(\d{1,2})\/(\d{1,2})\/202[0-5]/gi, `$1/$2/2026`);
    
    // Substituir "Hoje é dia XX de YYY de 202X" por data correta
    resposta = resposta.replace(/Hoje é\s+dia\s+\d{1,2}.*?202[0-5]/gi, `Hoje é ${dataAtualPT}`);
    
    if (!naoGuardar) salvarConversa(usuario, mensagem, resposta);
    res.json({ resposta });
  } catch (err) {
    const apiStatus = err?.status || err?.code || 500;
    const providerMessage = err?.error?.message || err?.message || "Erro desconhecido na OpenAI";
    console.error("Erro no OpenAI /chat:", {
      status: apiStatus,
      message: providerMessage,
      type: err?.error?.type,
      code: err?.error?.code
    });

    if (/mem(ó|o)ria insuficiente|requires more system memory|unable to allocate/i.test(String(providerMessage).toLowerCase())) {
      return res.json({
        resposta: "Estou com pouca memória no modo local agora. Tente uma pergunta mais curta ou reinicie o Ollama."
      });
    }

    res.status(500).json({ resposta: `Erro no chat (OpenAI/Ollama): ${providerMessage}` });
  }
});

// 🔹 endpoint para analisar foto enviada pelo utilizador
app.post("/analisar-imagem", async (req, res) => {
  const { usuario, mensagem, naoGuardar, imagemBase64 } = req.body;

  const planoInfo = verificarPlano(usuario);
  if (!planoInfo.valido) {
    return res.json({
      resposta: "Seu plano expirou! Renove para continuar usando.",
      plano_expirado: true
    });
  }

  if (!imagemBase64) {
    return res.status(400).json({ resposta: "Nenhuma imagem recebida para análise." });
  }

  const pergunta = (mensagem || "").trim() || "Descreve esta imagem com detalhes.";
  const imagemSemPrefixo = String(imagemBase64).replace(/^data:.*;base64,/, "");

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOllamaVisionModel(),
        messages: [
          {
            role: "system",
            content: "Você é Lumina. Analise a imagem de forma clara e útil, em português."
          },
          {
            role: "user",
            content: pergunta,
            images: [imagemSemPrefixo]
          }
        ],
        stream: false,
        options: {
          num_ctx: getOllamaNumCtx(),
          ...(usarOllamaEmCpu() ? { num_gpu: 0 } : {})
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      if (/not found|model.*not/i.test(text)) {
        return res.json({
          resposta: `Modelo de visão não instalado no Ollama. Execute: ollama pull ${getOllamaVisionModel()}`
        });
      }
      if (/requires more system memory|unable to allocate|available/i.test(text)) {
        return res.json({
          resposta: "Não consegui analisar a imagem por falta de memória no Ollama. Tente um modelo de visão mais leve."
        });
      }
      return res.json({ resposta: `Falha ao analisar imagem: ${text}` });
    }

    const data = await response.json();
    const resposta = data?.message?.content || "Não consegui analisar a imagem agora.";

    if (!naoGuardar) {
      salvarConversa(usuario, `[Imagem] ${pergunta}`, resposta);
    }

    return res.json({ resposta });
  } catch (err) {
    return res.json({
      resposta: "O analisador de imagem local não está disponível agora."
    });
  }
});

// 🔹 endpoint histórico de conversas
app.post("/historico", (req, res) => {
  const { usuario } = req.body;
  const historico = obterHistoricoConversas(usuario);
  res.json({ sucesso: true, conversas: historico });
});

// 🔹 endpoint obter conversa específica
app.post("/conversa", (req, res) => {
  const { usuario, conversaId } = req.body;
  const conversa = obterConversa(usuario, conversaId);
  if (conversa) {
    res.json({ sucesso: true, conversa });
  } else {
    res.json({ sucesso: false, erro: "Conversa não encontrada" });
  }
});

// 🔹 endpoint excluir conversa
app.post("/excluir-conversa", (req, res) => {
  const { usuario, conversaId } = req.body;
  const sucesso = excluirConversa(usuario, conversaId);
  if (sucesso) {
    res.json({ sucesso: true, mensagem: "Conversa excluída" });
  } else {
    res.json({ sucesso: false, erro: "Não foi possível excluir a conversa" });
  }
});

// 🔹 endpoint guardar preferência
app.post("/guardar-preferencia", (req, res) => {
  const { usuario, chave, valor } = req.body;
  const sucesso = salvarPreferencia(usuario, chave, valor);
  if (sucesso) {
    res.json({ sucesso: true, mensagem: "Preferência guardada" });
  } else {
    res.json({ sucesso: false, erro: "Erro ao guardar preferência" });
  }
});

// 🔹 endpoint obter perfil
app.post("/obter-perfil", (req, res) => {
  const { usuario } = req.body;
  const perfil = obterPerfil(usuario);
  if (perfil) {
    res.json({ sucesso: true, perfil });
  } else {
    res.json({ sucesso: false, erro: "Perfil não encontrado" });
  }
});

// 🔹 endpoint imagem
app.post("/imagem", async (req, res) => {
  const { prompt } = req.body;
  try {
    const imageProvider = getImageProvider();
    let result;
    let aviso = null;

    if (imageProvider === "ollamadiffuser") {
      try {
        result = await gerarImagemOllamaDiffuser(prompt);
      } catch (diffuserErr) {
        if (permitirFallbackAleatorio()) {
          try {
            result = await gerarImagemPicsum(prompt);
            aviso = "OllamaDiffuser indisponível. Foi usada imagem de fallback via Picsum.";
          } catch (picsumErr) {
            aviso = "OllamaDiffuser indisponível. Foi usada imagem fallback local.";
            result = gerarImagemFallbackSvg(prompt);
          }
        } else {
          aviso = "OllamaDiffuser indisponível. Foi usada imagem fallback local (sem aleatória).";
          result = gerarImagemFallbackSvg(prompt);
        }
      }
    } else if (imageProvider === "ollama") {
      try {
        result = await gerarImagemOllama(prompt);
      } catch (ollamaErr) {
        if (permitirFallbackAleatorio()) {
          try {
            result = await gerarImagemUnsplash(prompt);
            aviso = "Modelo local indisponível. Foi usada imagem de fallback via Unsplash.";
          } catch (unsplashErr) {
            try {
              result = await gerarImagemPicsum(prompt);
              aviso = "Modelo local indisponível. Foi usada imagem de fallback via Picsum.";
            } catch (picsumErr) {
              aviso = "Modelo local indisponível. Foi usada imagem fallback local.";
              result = gerarImagemFallbackSvg(prompt);
            }
          }
        } else {
          aviso = "Modelo local indisponível. Foi usada imagem fallback local (sem aleatória).";
          result = gerarImagemFallbackSvg(prompt);
        }
      }
    } else {
      try {
        result = await gerarImagemPollinations(prompt);
      } catch (pollinationsErr) {
        try {
          result = await gerarImagemOllama(prompt);
          aviso = "Serviço externo indisponível. Foi usado modelo local.";
        } catch (ollamaErr) {
          if (permitirFallbackAleatorio()) {
            try {
              result = await gerarImagemUnsplash(prompt);
              aviso = "Gerador principal indisponível. Foi usada imagem de fallback via Unsplash.";
            } catch (unsplashErr) {
              try {
                result = await gerarImagemPicsum(prompt);
                aviso = "Gerador principal indisponível. Foi usada imagem de fallback via Picsum.";
              } catch (picsumErr) {
                aviso = "Sem internet e sem modelo local. Foi usada imagem fallback local.";
                result = gerarImagemFallbackSvg(prompt);
              }
            }
          } else {
            aviso = "Gerador principal indisponível. Foi usada imagem fallback local (sem aleatória).";
            result = gerarImagemFallbackSvg(prompt);
          }
        }
      }
    }

    res.json({ imagem: result.base64, mime: result.contentType, aviso });
  } catch (err) {
    console.error("erro imagem", err);
    const fallback = gerarImagemFallbackSvg(prompt || "Imagem gerada pela Lumina");
    res.json({
      imagem: fallback.base64,
      mime: fallback.contentType,
      aviso: "Foi usada imagem fallback local por erro interno."
    });
  }
});

// Servir favicon guardado na raiz do projeto.
app.get("/favicon.png", (req, res) => {
  res.sendFile(path.join(__dirname, "../favicon.png"));
});

// 🔹 2️⃣ Servir frontend por último
app.use(express.static(path.join(__dirname, "../frontend")));

// 🔹 3️⃣ Rodar servidor
app.listen(process.env.PORT || 3000, () => console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`));