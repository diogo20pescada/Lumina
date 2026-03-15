const usuarios = [];
let conversas = [];

function registrar(nome, email, senha) {
  const existe = usuarios.find(u => u.email === email);
  if (existe) return false;
  usuarios.push({
    nome,
    email,
    senha,
    plano: "gratuito",
    data_expiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias grátis
    historico_conversas: [], // Novo: histórico por utilizador
    perfil: {
      nomeUso: nome,
      corFavorita: null,
      preferencias: {}
    }
  });
  return true;
}

function autenticar(email, senha) {
  return usuarios.find(u => u.email === email && u.senha === senha);
}

function salvarConversa(usuario, mensagem, resposta) {
  const userObj = usuarios.find(u => u.email === usuario);
  if (!userObj) return false;
  
  // Extrair palavras-chave (primeiras palavras)
  const palavras = mensagem.split(' ').slice(0, 5).join(' ');
  const titulo = palavras.length > 30 ? palavras.substring(0, 30) + '...' : palavras;
  
  const conversa = {
    id: Date.now().toString(),
    titulo,
    mensagem,
    resposta,
    data: new Date()
  };
  
  conversas.push({ usuario, ...conversa });
  userObj.historico_conversas.push(conversa);
  return true;
}

// Novo: obter histórico de conversas de um utilizador
function obterHistoricoConversas(usuario) {
  const userObj = usuarios.find(u => u.email === usuario);
  return userObj ? userObj.historico_conversas : [];
}

// Novo: obter uma conversa específica
function obterConversa(usuario, conversaId) {
  const userObj = usuarios.find(u => u.email === usuario);
  if (!userObj) return null;
  return userObj.historico_conversas.find(c => c.id === conversaId);
}

// Novo: excluir uma conversa
function excluirConversa(usuario, conversaId) {
  const userObj = usuarios.find(u => u.email === usuario);
  if (!userObj) return false;
  
  const index = userObj.historico_conversas.findIndex(c => c.id === conversaId);
  if (index !== -1) {
    userObj.historico_conversas.splice(index, 1);
    return true;
  }
  return false;
}

// Novo: guardar preferências do utilizador
function salvarPreferencia(usuario, chave, valor) {
  const userObj = usuarios.find(u => u.email === usuario);
  if (!userObj) return false;
  
  userObj.perfil[chave] = valor;
  return true;
}

// Novo: obter preferências do utilizador
function obterPerfil(usuario) {
  const userObj = usuarios.find(u => u.email === usuario);
  if (!userObj) return null;
  return userObj.perfil;
}

function atualizarPlano(email, plano, dias) {
  const user = usuarios.find(u => u.email === email);
  if (user) {
    user.plano = plano;
    user.data_expiracao = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    return true;
  }
  return false;
}

function verificarPlano(email) {
  const user = usuarios.find(u => u.email === email);
  if (!user) return { valido: false, plano: null };
  const agora = new Date();
  const expirado = user.data_expiracao < agora;
  return {
    valido: !expirado,
    plano: user.plano,
    data_expiracao: user.data_expiracao,
    expirado
  };
}

export { registrar, autenticar, salvarConversa, atualizarPlano, verificarPlano, obterHistoricoConversas, obterConversa, excluirConversa, salvarPreferencia, obterPerfil };