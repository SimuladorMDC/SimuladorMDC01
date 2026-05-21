let gruposColetados = [];
let tab = null;
let varrendo = false;
let pollInterval = null;

document.getElementById('btn-varrer').addEventListener('click', varrerTodos);
document.getElementById('btn-baixar').addEventListener('click', baixarJSON);
document.getElementById('btn-fechar').addEventListener('click', () => window.close());

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
  tab = tabs[0];
  if (!tab.url || !tab.url.includes('clickvenda.app')) {
    setStatus('<strong style="color:#FF5757">⚠ Abra o Clik Vendas primeiro</strong>');
    return;
  }
  setStatus('<strong style="color:#10D98C">✓ Pronto!</strong><br>Selecione Plano + Marca/Modelo, clique BUSCAR na página, depois clique abaixo.');
  document.getElementById('btn-varrer').disabled = false;
});

function setStatus(html) {
  document.getElementById('status').innerHTML = html;
}

function varrerTodos() {
  if (varrendo) return;
  varrendo = true;
  gruposColetados = [];

  document.getElementById('btn-varrer').disabled = true;
  document.getElementById('btn-baixar').disabled = true;
  document.getElementById('progress').style.display = 'block';
  setStatus('<strong>⚡ Varredura iniciada!</strong><br>Acompanhe a barra roxa no topo da página.<br>Não feche esta janela.');

  // Limpa progresso anterior
  chrome.storage.local.remove('mdc_progresso');

  // Inicia poll ANTES de enviar mensagem
  pollInterval = setInterval(lerProgresso, 800);

  // Envia comando — ignora erro de comunicação, o content script já foi injetado
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    func: () => {
      // Dispara evento customizado que o content script escuta
      window.dispatchEvent(new CustomEvent('mdc_iniciar_varredura'));
    }
  }).catch(() => {
    // Fallback: tenta via messaging
    chrome.tabs.sendMessage(tab.id, {action: 'VARRER_TODOS'}, () => {
      chrome.runtime.lastError; // consume error
    });
  });
}

function lerProgresso() {
  chrome.storage.local.get('mdc_progresso', data => {
    if (!data.mdc_progresso) return;
    const p = data.mdc_progresso;

    if (p.erro) {
      clearInterval(pollInterval);
      chrome.storage.local.remove('mdc_progresso');
      varrendo = false;
      setStatus(`<strong style="color:#FF5757">⚠ ${p.erro}</strong>`);
      document.getElementById('btn-varrer').disabled = false;
      document.getElementById('progress').style.display = 'none';
      return;
    }

    const pct = p.total > 0 ? Math.round((p.progresso / p.total) * 100) : 0;
    document.getElementById('prog-bar').style.width = pct + '%';
    document.getElementById('prog-count').textContent = `${p.progresso}/${p.total}`;
    document.getElementById('prog-grupos').textContent = `${(p.grupos||[]).length} grupos coletados`;
    if (p.grupos) gruposColetados = p.grupos;

    if (p.concluido) {
      clearInterval(pollInterval);
      chrome.storage.local.remove('mdc_progresso');
      varrendo = false;
      concluido();
    }
  });
}

function concluido() {
  const n = gruposColetados.length;
  document.getElementById('prog-bar').style.width = '100%';
  setStatus(`<strong style="color:#10D98C">✅ ${n} grupo(s) coletados!</strong><br>Clique em 💾 Baixar arquivo JSON`);
  document.getElementById('btn-baixar').disabled = false;
  document.getElementById('btn-varrer').disabled = false;
  const al = document.getElementById('alerta');
  al.style.display = 'block';
  al.innerHTML = 'No simulador: aba <strong>Grupos</strong> → <strong>📥 Importar JSON</strong>';
}

function baixarJSON() {
  if (!gruposColetados.length) return;
  const novos = gruposColetados.map(g => ({
    num:  String(g.num || ''),
    cred: Number(g.cred || 0),
    parc: Number(g.parcela || g.parc || 0),
    pr:   Number(g.prazo || g.pr || 0),
    ml:   Number(g.mediaLance || g.ml || 0),
    ta:   Number(g.ta || 0),
    ti:   String(g.tipo || g.ti || 'FXI'),
    pl:   String(g.plano || g.pl || 'Light'),
    id:   Date.now() + Math.random()
  }));
  const blob = new Blob([JSON.stringify({mdc_import:true, grupos:novos, total:novos.length})], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({url, filename:`mdc_grupos_${novos.length}.json`, saveAs:false}, () => {
    setStatus(`<strong style="color:#10D98C">✅ ${novos.length} grupos baixados!</strong><br>Importe no simulador → aba Grupos → 📥 Importar`);
  });
}
