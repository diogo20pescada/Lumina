let usuarioAtivo = "";
let nomeAtivo = "";
let planoAtivo = "";
let planoValido = false;
let mostrouNome = false;
let perfilUsuario = {};
let imagemSelecionadaBase64 = "";
let imagemSelecionadaMime = "";
let imagemSelecionadaNome = "";

const loginBox = document.getElementById("loginBox");
const chatBox = document.getElementById("chatBox");
const planosBox = document.getElementById("planosBox");
const status = document.getElementById("status");
const boasVindas = document.getElementById("boasVindas");
const nomeReg = document.getElementById("nomeReg");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const inputFoto = document.getElementById("inputFoto");
const btnCarregarFoto = document.getElementById("btnCarregarFoto");

function resetImagemSelecionada() {
    imagemSelecionadaBase64 = "";
    imagemSelecionadaMime = "";
    imagemSelecionadaNome = "";
    inputFoto.value = "";
    btnCarregarFoto.classList.remove("ativo");
    btnCarregarFoto.textContent = "📷 Foto";
}

function lerFicheiroComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

btnCarregarFoto.onclick = () => {
    inputFoto.click();
};

inputFoto.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Selecione apenas imagens.");
        resetImagemSelecionada();
        return;
    }

    try {
        const dataUrl = await lerFicheiroComoDataURL(file);
        const [meta, base64] = String(dataUrl).split(",");
        imagemSelecionadaBase64 = base64 || "";
        imagemSelecionadaMime = (meta.match(/data:(.*?);base64/) || [])[1] || file.type || "image/png";
        imagemSelecionadaNome = file.name;

        btnCarregarFoto.classList.add("ativo");
        btnCarregarFoto.textContent = "✅ Foto";
    } catch (err) {
        alert("Não foi possível ler a imagem selecionada.");
        resetImagemSelecionada();
    }
};

function escaparHtml(texto) {
    return texto
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function pedidoDeImagem(texto) {
    const t = texto.toLowerCase();
    return /(criar|cria|gera|gerar|fazer|faz).*(imagem|foto|ilustra|desenho)|\bimagem de\b/.test(t);
}

function extrairPromptImagem(texto) {
    const limpo = texto
        .replace(/^(podes|pode|consegues|consegue)\s+/i, "")
        .replace(/^(por favor|pfv|pls)\s+/i, "")
        .replace(/^(criar|cria|gera|gerar|fazer|faz)\s+(uma\s+|um\s+)?(imagem|foto|ilustração|ilustracao|desenho)\s*(de|do|da)?\s*/i, "")
        .replace(/^imagem\s+(de|do|da)\s*/i, "")
        .trim();

    return limpo || "um logo moderno da Lumina com fundo limpo";
}

function abrirImagemEmGrande(src) {
    let modal = document.getElementById("imagePreviewModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "imagePreviewModal";
        modal.className = "image-preview-modal";
        modal.innerHTML = `
            <div class="image-preview-backdrop"></div>
            <div class="image-preview-content">
                <button id="btnFecharImagemPreview" class="image-preview-close">✕</button>
                <img id="imagemPreviewGrande" alt="Imagem gerada">
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector(".image-preview-backdrop").onclick = () => {
            modal.classList.remove("active");
        };
        modal.querySelector("#btnFecharImagemPreview").onclick = () => {
            modal.classList.remove("active");
        };
    }

    const img = document.getElementById("imagemPreviewGrande");
    img.src = src;
    modal.classList.add("active");
}

function criarBalaoImagem(base64Imagem, promptImagem, mime = "image/png") {
    const src = `data:${mime};base64,${base64Imagem}`;
    const balao = document.createElement("p");
    balao.className = "ai ai-image";

    const header = document.createElement("b");
    header.textContent = "Lumina:";

    const legenda = document.createElement("span");
    legenda.className = "imagem-legenda";
    legenda.textContent = `Imagem criada para: ${promptImagem}`;

    const imagem = document.createElement("img");
    imagem.className = "imagem-gerada";
    imagem.src = src;
    imagem.alt = `Imagem gerada: ${promptImagem}`;

    const menuWrap = document.createElement("div");
    menuWrap.className = "imagem-menu-wrap";

    const menuBtn = document.createElement("button");
    menuBtn.className = "btn-menu-toggle";
    menuBtn.textContent = "⋮";
    menuBtn.onclick = function(e) {
        e.stopPropagation();
        const dropdown = menuWrap.querySelector(".menu-dropdown");
        document.querySelectorAll(".menu-dropdown").forEach(m => {
            if (m !== dropdown) m.style.display = "none";
        });
        dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
    };

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";
    dropdown.style.display = "none";

    const abrirBtn = document.createElement("button");
    abrirBtn.className = "menu-item";
    abrirBtn.textContent = "🖼️ Abrir em grande";
    abrirBtn.onclick = function(e) {
        e.stopPropagation();
        abrirImagemEmGrande(src);
        dropdown.style.display = "none";
    };

    const baixarBtn = document.createElement("button");
    baixarBtn.className = "menu-item";
    baixarBtn.textContent = "⬇️ Baixar";
    baixarBtn.onclick = function(e) {
        e.stopPropagation();
        const a = document.createElement("a");
        a.href = src;
        a.download = `lumina-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        dropdown.style.display = "none";
    };

    dropdown.appendChild(abrirBtn);
    dropdown.appendChild(baixarBtn);
    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(dropdown);

    balao.appendChild(header);
    balao.appendChild(document.createElement("br"));
    balao.appendChild(legenda);
    balao.appendChild(imagem);
    balao.appendChild(menuWrap);

    return balao;
}

function adicionarAvisoImagem(balaoImagem, aviso) {
    if (!aviso) return;
    const avisoEl = document.createElement("small");
    avisoEl.style.color = "#7a4f00";
    avisoEl.style.fontSize = "11px";
    avisoEl.textContent = `Aviso: ${aviso}`;
    balaoImagem.appendChild(avisoEl);
}

// Registrar - dois passos
document.getElementById("btnRegistrar").onclick = () => {
    if (!mostrouNome) {
        nomeReg.style.display = "block";
        status.innerText = "Digite seu nome para registrar";
        mostrouNome = true;
        return;
    }
    registar();
};

async function registar() {
    const nome = nomeReg.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!nome || !email || !senha) {
        status.innerText = "Preencha nome, email e senha";
        return;
    }

    const res = await fetch("/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json();
    if (data.sucesso) {
        usuarioAtivo = email;
        nomeAtivo = nome;
        loginBox.style.display = "none";
        chatBox.style.display = "block";
        boasVindas.innerText = `Olá, ${nomeAtivo}! 👋`;
        nomeReg.value = "";
        emailInput.value = "";
        senhaInput.value = "";
        nomeReg.style.display = "none";
        mostrouNome = false;
        status.innerText = "";
        window.scrollTo(0, 0); // Scroll para o topo
        carregarHistorico(); // Carregar histórico
        carregarPerfil(); // Carregar preferências do utilizador
    } else {
        status.innerText = "Erro: " + data.erro;
    }
}



// Login
document.getElementById("btnLogin").onclick = async () => {
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!email || !senha) {
        status.innerText = "Preencha email e senha";
        return;
    }

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
    });

    const data = await res.json();
    if (data.sucesso) {
        usuarioAtivo = email;
        nomeAtivo = data.nome;
        planoAtivo = data.plano;
        planoValido = data.valido;

        if (!planoValido) {
            // Plano expirado, mostrar planos
            loginBox.style.display = "none";
            planosBox.style.display = "flex";
            status.innerText = "Seu plano expirou. Escolha um novo plano.";
        } else {
            // Plano válido, ir para chat
            loginBox.style.display = "none";
            chatBox.style.display = "flex";
            boasVindas.innerText = `Olá, ${nomeAtivo}! Plano: ${planoAtivo}`;
            window.scrollTo(0, 0); // Scroll para o topo
            carregarHistorico(); // Carregar histórico
            carregarPerfil(); // Carregar preferências do utilizador
        }
        emailInput.value = "";
        senhaInput.value = "";
        status.innerText = "";
    } else {
        status.innerText = "Email ou senha incorretos";
    }
};

// Enviar mensagem
document.getElementById("btnEnviar").onclick = async () => {
    const mensagemInput = document.getElementById("mensagem");
    const mensagem = mensagemInput.value;
    const naoGuardar = document.getElementById("naoGuardar").checked;

    if (!mensagem.trim() && !imagemSelecionadaBase64) return;

    const conversasDiv = document.getElementById("conversas");
    
    // Adicionar mensagem do utilizador
    const textoUser = mensagem.trim() ? escaparHtml(mensagem) : "(Analisar imagem)";
    const anexoInfo = imagemSelecionadaNome ? `<br><small>📎 ${escaparHtml(imagemSelecionadaNome)}</small>` : "";
    conversasDiv.innerHTML += `<p class="user"><b>Você:</b> ${textoUser}${anexoInfo}</p>`;
    
    // Adicionar balão de loading
    const loadingId = "loading-" + Date.now();
    conversasDiv.innerHTML += `<p class="ai" id="${loadingId}"><b>Lumina:</b> <span class="loader">.</span></p>`;
    conversasDiv.scrollTop = conversasDiv.scrollHeight;
    
    // Animar os pontos
    const loadingEl = document.getElementById(loadingId);
    let dotCount = 0;
    const loadingInterval = setInterval(() => {
        dotCount = (dotCount % 3) + 1;
        if (loadingEl) {
            loadingEl.querySelector(".loader").textContent = ".".repeat(dotCount);
        }
    }, 500);

    try {
        if (imagemSelecionadaBase64) {
            const resAnalise = await fetch("/analisar-imagem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usuario: usuarioAtivo,
                    mensagem,
                    naoGuardar,
                    imagemBase64: imagemSelecionadaBase64,
                    mime: imagemSelecionadaMime
                })
            });

            let dataAnalise;
            const contentType = resAnalise.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                dataAnalise = await resAnalise.json();
            } else {
                const raw = await resAnalise.text();
                dataAnalise = { resposta: raw || "Falha ao analisar imagem." };
            }
            clearInterval(loadingInterval);

            if (loadingEl) {
                loadingEl.innerHTML = `<b>Lumina:</b> ${escaparHtml(dataAnalise.resposta || "Não consegui analisar esta imagem agora.")}`;
            }

            detectarPreferencias(mensagem || "", dataAnalise.resposta || "");
            resetImagemSelecionada();
        } else if (pedidoDeImagem(mensagem)) {
            const promptImagem = extrairPromptImagem(mensagem);
            const resImagem = await fetch("/imagem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: promptImagem })
            });

            const dataImagem = await resImagem.json();
            clearInterval(loadingInterval);

            if (loadingEl) {
                if (resImagem.ok && dataImagem.imagem) {
                    const balaoImagem = criarBalaoImagem(dataImagem.imagem, promptImagem, dataImagem.mime || "image/png");
                    adicionarAvisoImagem(balaoImagem, dataImagem.aviso);
                    loadingEl.replaceWith(balaoImagem);
                } else {
                    loadingEl.innerHTML = `<b>Lumina:</b> Não consegui gerar a imagem agora. ${escaparHtml(dataImagem.erro || "Tente outro prompt ou verifique o modelo no Ollama.")}`;
                }
            }
        } else {
            const res = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: usuarioAtivo, mensagem, naoGuardar })
            });

            clearInterval(loadingInterval);
            const data = await res.json();

            detectarPreferencias(mensagem, data.resposta);

            if (loadingEl) {
                if (data.plano_expirado) {
                    loadingEl.innerHTML = `<b>Lumina:</b> ${escaparHtml(data.resposta)} <button onclick="mostrarPlanos()">Renovar Plano</button>`;
                } else {
                    loadingEl.innerHTML = `<b>Lumina:</b> ${escaparHtml(data.resposta)}`;
                }
            }
        }
    } catch (err) {
        clearInterval(loadingInterval);
        if (loadingEl) {
            loadingEl.innerHTML = "<b>Lumina:</b> Ocorreu um erro ao processar o pedido.";
        }
    }

    conversasDiv.scrollTop = conversasDiv.scrollHeight;
    mensagemInput.value = "";
};

// Escolher plano - PAGAMENTO COM STRIPE
async function escolherPlano(plano) {
    if (plano === 'gratuito') {
        // Continuar gratuito (já tem 7 dias)
        planosBox.style.display = "none";
        chatBox.style.display = "flex";
        boasVindas.innerText = `Olá, ${nomeAtivo}! Plano: gratuito`;
        window.scrollTo(0, 0); // Scroll para o topo
        carregarHistorico(); // Carregar histórico
        return;
    }

    // Links de pagamento Stripe por plano
        const stripeLinks = {
                basico: "https://buy.stripe.com/test_9B69AUbR2a6caNae2dg7e00",
                premium: "https://buy.stripe.com/test_bJebJ29IU9282gE3nzg7e01"
        };
    const stripePaymentLink = stripeLinks[plano];
    
    // Redirecionar para Stripe
    window.location.href = stripePaymentLink;
}

// Mostrar planos (para renovar)
function mostrarPlanos() {
    chatBox.style.display = "none";
    planosBox.style.display = "flex";
    window.scrollTo(0, 0); // Scroll para o topo
}

// Botão mudar plano
document.getElementById("btnMudarPlano").onclick = () => {
    mostrarPlanos();
};

// Carregar histórico de conversas
async function carregarHistorico() {
    const res = await fetch("/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioAtivo })
    });
    
    const data = await res.json();
    if (data.sucesso) {
        const listaHistorico = document.getElementById("listaHistorico");
        listaHistorico.innerHTML = "";
        
        if (data.conversas.length === 0) {
            listaHistorico.innerHTML = "<p style='font-size: 12px; color: #999; padding: 10px;'>Nenhuma conversa guardada</p>";
            return;
        }
        
        data.conversas.reverse().forEach((conversa, index) => {
            const item = document.createElement("div");
            item.className = "item-historico";
            
            const titulo = document.createElement("span");
            titulo.className = "item-titulo";
            titulo.textContent = conversa.titulo;
            
            const menuDiv = document.createElement("div");
            menuDiv.className = "item-menu";
            
            const menuBtn = document.createElement("button");
            menuBtn.className = "btn-menu-toggle";
            menuBtn.textContent = "⋮";
            menuBtn.onclick = function(e) {
                e.stopPropagation();
                const dropdown = menuDiv.querySelector(".menu-dropdown");
                document.querySelectorAll(".menu-dropdown").forEach(m => {
                    if (m !== dropdown) m.style.display = "none";
                });
                dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
            };
            
            const dropdown = document.createElement("div");
            dropdown.className = "menu-dropdown";
            dropdown.style.display = "none";
            
            const abrirBtn = document.createElement("button");
            abrirBtn.className = "menu-item";
            abrirBtn.textContent = "👁️ Abrir";
            abrirBtn.onclick = function(e) {
                e.stopPropagation();
                abrirConversa(conversa);
                dropdown.style.display = "none";
            };
            
            const deletarBtn = document.createElement("button");
            deletarBtn.className = "menu-item menu-delete";
            deletarBtn.textContent = "🗑️ Deletar";
            deletarBtn.onclick = function(e) {
                e.stopPropagation();
                deletarConversa(conversa.id);
                dropdown.style.display = "none";
            };
            
            dropdown.appendChild(abrirBtn);
            dropdown.appendChild(deletarBtn);
            menuDiv.appendChild(menuBtn);
            menuDiv.appendChild(dropdown);
            
            item.appendChild(titulo);
            item.appendChild(menuDiv);
            listaHistorico.appendChild(item);
        });
    }
}

// Toggle menu
function toggleMenu(index) {
    const menu = document.getElementById(`menu-${index}`);
    if (menu) {
        const allMenus = document.querySelectorAll(".menu-dropdown");
        allMenus.forEach(m => {
            if (m !== menu) m.style.display = "none";
        });
        menu.style.display = menu.style.display === "none" ? "flex" : "none";
    }
}

// Fechar menu ao clicar fora
document.addEventListener("click", () => {
    document.querySelectorAll(".menu-dropdown").forEach(menu => {
        menu.style.display = "none";
    });
});

// Deletar conversa
async function deletarConversa(conversaId) {
    if (!confirm("Tem a certeza que quer deletar esta conversa?")) return;
    
    const res = await fetch("/excluir-conversa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioAtivo, conversaId })
    });
    
    const data = await res.json();
    if (data.sucesso) {
        carregarHistorico(); // Recarregar lista
        alert("Conversa deletada com sucesso");
    } else {
        alert("Erro ao deletar conversa");
    }
}

// Abrir conversa do histórico
function abrirConversa(conversa) {
    const conversasDiv = document.getElementById("conversas");
    conversasDiv.innerHTML = `
        <p style="text-align: center; color: #999; font-size: 12px;">📌 Conversa guardada em ${new Date(conversa.data).toLocaleDateString('pt-PT')}</p>
        <p class="user"><b>Você:</b> ${conversa.mensagem}</p>
        <p class="ai"><b>Lumina:</b> ${conversa.resposta}</p>
    `;
}

// Botão ver histórico
document.getElementById("btnHistorico").onclick = () => {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
};

// Botão fechar sidebar
document.getElementById("btnFecharSidebar").onclick = () => {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("active");
};

// Botão mudar plano
document.getElementById("btnMudarPlano").onclick = () => {
    mostrarPlanos();
};

// Carregar perfil do utilizador
async function carregarPerfil() {
    const res = await fetch("/obter-perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioAtivo })
    });
    
    const data = await res.json();
    if (data.sucesso) {
        perfilUsuario = data.perfil;
    }
}

// Guardar preferência do utilizador
async function guardarPreferencia(chave, valor) {
    const res = await fetch("/guardar-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioAtivo, chave, valor })
    });
    
    const data = await res.json();
    if (data.sucesso) {
        // Atualizar perfilUsuario localmente
        if (chave === "corFavorita") {
            perfilUsuario.corFavorita = valor;
        } else if (chave === "nomeUso") {
            perfilUsuario.nomeUso = valor;
        }
    }
}

// Detectar preferências nas mensagens (cores, nomes, etc)
function detectarPreferencias(mensagem, resposta) {
    const texto = (mensagem + " " + resposta).toLowerCase();
    
    // Detectar cor favorita
    const coresPattern = /(cor favorita|cor prefer|minha cor|cor que gosto|favorite color|prefer.*color|prefer.*cor)[\s:é]{1,3}([\w\s]+?)(?:[.,!?\s]|$)/gi;
    let corMatch;
    while ((corMatch = coresPattern.exec(texto)) !== null) {
        const corPossivel = corMatch[2].trim().split(/[\s,]/).shift();
        if (corPossivel && corPossivel.length > 0) {
            guardarPreferencia("corFavorita", corPossivel);
            break;
        }
    }
    
    // Detectar nome do utilizador
    const nomePattern = /(meu nome é|nome é|my name is|i'm|chamo-?me|sou|call me|você pode me chamar de)[\s:]{1,2}([\w\s]+?)(?:[.,!?\s]|$)/gi;
    let nomeMatch;
    while ((nomeMatch = nomePattern.exec(texto)) !== null) {
        const nomePossivel = nomeMatch[2].trim().split(/[\s,]/).shift();
        if (nomePossivel && nomePossivel.length > 2) {
            guardarPreferencia("nomeUso", nomePossivel);
            break;
        }
    }
}

// Expor funções globalmente para eventos onclick no HTML
window.escolherPlano = escolherPlano;
window.mostrarPlanos = mostrarPlanos;
window.carregarHistorico = carregarHistorico;
window.abrirConversa = abrirConversa;
window.deletarConversa = deletarConversa;
window.toggleMenu = toggleMenu;