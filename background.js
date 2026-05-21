// background.js — repassa mensagens de progresso ao popup
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'PROGRESSO') {
    // Guarda no storage para o popup ler
    chrome.storage.local.set({mdc_progresso: msg});
  }
});
