let varrendo = false;

function getPlano() {
  let plano = '';
  document.querySelectorAll('select').forEach(sel => {
    const txt = sel.options[sel.selectedIndex]?.text || '';
    if (txt.match(/PLANO|LIGHT|INTEGRAL|FXI|FXII|LIVRE|PESADO|PAC/i)) plano = txt;
  });
  return plano;
}

function tipoPlano(p) {
  const u = p.toUpperCase();
  if (u.includes('FXIII')||u.includes('FX.III')) return 'FXIII';
  if (u.includes('FXII')||u.includes('FX.II')) return 'FXII';
  if (u.includes('LIVRE')) return 'Livre';
  if (u.includes('PESAD')) return 'Pesado';
  return 'FXI';
}

function tipoPlanoVisual(p) {
  const u = p.toUpperCase();
  if (u.includes('50')) return '50';
  if (u.includes('75')||u.includes('LIGHT')) return 'Light';
  return 'Integral';
}

// Lê a tabela ATUAL da página — grupos com parcelas do crédito atual
function lerTabelaAtual(plano, credito, credVal) {
  const grupos = [];
  const tipo = tipoPlano(plano);
  const planTipo = tipoPlanoVisual(plano);
  const pm = s => parseFloat((s||'').replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.')) || 0;
  const pp = s => parseFloat((s||'').replace(',','.')) || 0;

  document.querySelectorAll('table').forEach(t => {
    const ths = [...t.querySelectorAll('th')];
    const hdrs = ths.map(th => th.textContent.trim().toUpperCase().replace(/\s+/g,' '));
    if (!hdrs.some(h => h.includes('GRUPO'))) return;
    const fi = k => hdrs.findIndex(h => h.includes(k));
    const idx = {
      grupo: fi('GRUPO'), venc: fi('VENC'), prazo: fi('PRAZO'),
      media: Math.max(fi('MEDIA'),fi('MÉDIA')),
      ta: hdrs.findIndex(h=>h==='% TA'||(h.includes('%')&&h.includes('TA'))),
      parc: Math.max(fi('VALOR'),fi('1º PARCELA'),fi('1ª PARCELA')),
    };
    t.querySelectorAll('tbody tr').forEach(tr => {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 4) return;
      const get = i => (i>=0&&tds[i]) ? tds[i].textContent.trim() : '';
      const num = get(idx.grupo);
      if (!num||!num.match(/\d+/)) return;
      const parcRaw = get(idx.parc);
      const parcVal = pm(parcRaw);
      // Só adiciona se tiver parcela válida
      if (!parcVal) return;
      grupos.push({
        num, cred: credVal, credito_fmt: credito,
        parcela: parcVal, parcela_fmt: parcRaw,
        prazo: parseInt(get(idx.prazo))||0,
        mediaLance: pp(get(idx.media)),
        ta: pp(get(idx.ta)),
        tipo, plano: planTipo,
        vencimento: get(idx.venc),
      });
    });
  });
  return grupos;
}

// Espera a tabela recarregar com NOVO conteúdo após troca de crédito
// Usa assinatura da tabela (soma das parcelas) para detectar mudança
function getAssinaturaTabela() {
  let sig = '';
  document.querySelectorAll('table').forEach(t => {
    const ths = [...t.querySelectorAll('th')];
    if (!ths.some(th=>th.textContent.toUpperCase().includes('GRUPO'))) return;
    sig = [...t.querySelectorAll('tbody td')].map(td=>td.textContent.trim()).join('|');
  });
  return sig;
}

function esperarTabelaMudar(assinaturaAnterior, timeout=10000) {
  return new Promise(resolve => {
    const inicio = Date.now();
    const check = () => {
      const nova = getAssinaturaTabela();
      // Considera mudou se assinatura diferente E tabela tem dados
      if (nova && nova !== assinaturaAnterior) { resolve(true); return; }
      if (Date.now() - inicio > timeout) { resolve(false); return; }
      setTimeout(check, 200);
    };
    setTimeout(check, 300);
  });
}

function esperarTabela(timeout=10000) {
  return new Promise(resolve => {
    const check = () => {
      for (const t of document.querySelectorAll('table')) {
        if ([...t.querySelectorAll('th')].some(th=>th.textContent.toUpperCase().includes('GRUPO')) &&
            t.querySelectorAll('tbody tr').length > 0) { resolve(t); return; }
      }
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {childList:true, subtree:true});
    setTimeout(()=>{obs.disconnect();resolve(null);}, timeout);
  });
}

function criarBanner() {
  document.getElementById('mdc-banner')?.remove();
  const div = document.createElement('div');
  div.id = 'mdc-banner';
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#1a1033;border-bottom:3px solid #7B5CFA;padding:10px 20px;font-family:sans-serif;font-size:13px;color:#fff;display:flex;align-items:center;gap:16px;';
  div.innerHTML = `
    <span style="color:#A78BFA;font-weight:700;flex-shrink:0">🚀 MDC</span>
    <span id="mdc-txt" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Iniciando...</span>
    <div style="width:200px;background:#0D0D12;border-radius:4px;height:8px;flex-shrink:0">
      <div id="mdc-bar" style="background:#7B5CFA;height:8px;border-radius:4px;width:0%;transition:width .3s"></div>
    </div>
    <span id="mdc-pct" style="color:#A78BFA;font-weight:700;min-width:45px;text-align:right;flex-shrink:0">0%</span>
    <span id="mdc-count" style="color:#9090A8;font-size:12px;flex-shrink:0">0 grupos</span>
    <button id="mdc-cancel" style="background:#FF5757;border:none;color:#fff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0">✕ Cancelar</button>
  `;
  document.body.appendChild(div);
  document.getElementById('mdc-cancel').addEventListener('click', () => {
    varrendo = false;
    document.getElementById('mdc-banner')?.remove();
  });
}

function atualizarBanner(txt, pct, totalGrupos) {
  const e=document.getElementById('mdc-txt');
  const b=document.getElementById('mdc-bar');
  const p=document.getElementById('mdc-pct');
  const c=document.getElementById('mdc-count');
  if(e) e.textContent=txt;
  if(b) b.style.width=pct+'%';
  if(p) p.textContent=pct+'%';
  if(c) c.textContent=totalGrupos+' grupos';
}

function encontrarSelectCredito() {
  return [...document.querySelectorAll('select')].find(sel =>
    [...sel.options].some(o => o.text.match(/CRED\s*REF|990\d{3}/i))
  );
}

function encontrarSelectModelo() {
  return [...document.querySelectorAll('select')].find(sel =>
    sel.options.length > 3 &&
    [...sel.options].some(o => o.text.match(/\d{3}[.,]\d{3}[,.]?\d{0,2}/)) &&
    ![...sel.options].some(o => o.text.match(/PLANO|LIGHT|INTEGRAL|FXI/i)) &&
    ![...sel.options].some(o => o.text.match(/VOLKSWAGEN|FIAT|FORD|TOYOTA|HONDA|RENAULT|HYUNDAI|CHEVROLET|GM /i))
  );
}

function extrairCredVal(label) {
  const pm = s => parseFloat((s||'').replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.')) || 0;
  const m = label.match(/([\d.]+,\d{2})\s*$/);
  return m ? pm(m[1]) : 0;
}

async function varrerTodos(callback) {
  if (varrendo) return;
  varrendo = true;
  const todosGrupos = [];
  const plano = getPlano();

  criarBanner();
  atualizarBanner('Detectando modo de busca...', 0, 0);

  // Detecta select para varrer
  const selectCred = encontrarSelectCredito();
  const selectModelo = encontrarSelectModelo();
  const select = selectCred || selectModelo;
  const modo = selectCred ? 'credito' : selectModelo ? 'modelo' : null;

  if (!select || !modo) {
    varrendo = false;
    document.getElementById('mdc-banner')?.remove();
    callback({erro: 'Selecione um plano e clique BUSCAR primeiro para carregar os grupos.'});
    return;
  }

  const opts = [...select.options].filter(o => o.value && o.text.trim() && !o.text.match(/^Selecione/i));
  if (!opts.length) {
    varrendo = false;
    document.getElementById('mdc-banner')?.remove();
    callback({erro: 'Nenhuma opção encontrada. Selecione uma Marca ou ative Crédito Referenciado.'});
    return;
  }

  callback({progresso:0, total:opts.length, grupos:[]});

  for (let i = 0; i < opts.length; i++) {
    if (!varrendo) break;

    const opt = opts[i];
    const label = opt.text.trim();
    const credVal = extrairCredVal(label);
    const pct = Math.round((i/opts.length)*100);

    atualizarBanner(`(${i+1}/${opts.length}) ${label.substring(0,50)}`, pct, todosGrupos.length);

    // Captura assinatura ANTES de trocar o crédito
    const assinaturaAntes = getAssinaturaTabela();

    // Seleciona a opção
    select.value = opt.value;
    select.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(r=>setTimeout(r,400));

    // Clica BUSCAR
    const btn = [...document.querySelectorAll('button,input[type=button],input[type=submit]')]
      .find(b => (b.textContent||b.value||'').trim().toUpperCase().includes('BUSCAR'));
    if (btn) {
      btn.click();
      await new Promise(r=>setTimeout(r,300));
    }

    // *** PONTO CRÍTICO: espera a tabela MUDAR (não apenas existir) ***
    // Isso garante que a parcela é do crédito atual, não do anterior
    const mudou = await esperarTabelaMudar(assinaturaAntes, 8000);
    
    // Aguarda mais um pouco para garantir que renderizou completamente
    await new Promise(r=>setTimeout(r,300));

    // Lê grupos com parcelas corretas para este crédito
    const grupos = lerTabelaAtual(plano, label, credVal);
    todosGrupos.push(...grupos);

    callback({progresso:i+1, total:opts.length, grupos:todosGrupos});
  }

  varrendo = false;
  atualizarBanner(`✅ Concluído! ${todosGrupos.length} grupos coletados. Volte ao popup → Baixar JSON.`, 100, todosGrupos.length);
  setTimeout(()=>document.getElementById('mdc-banner')?.remove(), 12000);
  callback({concluido:true, grupos:todosGrupos});
}

function lerGrupos() {
  const plano = getPlano();
  let credito = '';
  let credVal = 0;
  document.querySelectorAll('select').forEach(sel => {
    const txt = sel.options[sel.selectedIndex]?.text||'';
    if (txt.match(/CRED\s*REF|990\d{3}/i)) { credito = txt; credVal = extrairCredVal(txt); }
  });
  const matchBem = document.body.innerText.match(/Valor do Bem[:\s]+R\$\s*([\d.,]+)/i);
  if (matchBem && !credito) {
    credito = 'R$ '+matchBem[1];
    credVal = parseFloat(matchBem[1].replace(/\./g,'').replace(',','.')) || 0;
  }
  return {grupos: lerTabelaAtual(plano, credito, credVal), plano, credito};
}

// Listener do evento customizado (disparado pelo popup via scripting API)
window.addEventListener('mdc_iniciar_varredura', () => {
  varrerTodos(r => chrome.runtime.sendMessage({action:'PROGRESSO',...r}));
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'GET_GRUPOS') { sendResponse(lerGrupos()); }
  if (req.action === 'VARRER_TODOS') {
    varrerTodos(r => chrome.runtime.sendMessage({action:'PROGRESSO',...r}));
    sendResponse({ok:true});
  }
  return true;
});
