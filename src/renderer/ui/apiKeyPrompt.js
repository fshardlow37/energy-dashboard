export function showApiKeyPrompt(countryName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('api-key-modal');
    const input = document.getElementById('api-key-input');
    const saveBtn = document.getElementById('api-key-save');
    const cancelBtn = document.getElementById('api-key-cancel');
    const label = document.getElementById('api-key-label');

    if (label) label.textContent = `${countryName} requires a free API key.`;
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();

    function cleanup() {
      modal.classList.add('hidden');
      saveBtn.removeEventListener('click', onSave);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
    }

    function onSave() { cleanup(); resolve(input.value.trim() || null); }
    function onCancel() { cleanup(); resolve(null); }
    function onKey(e) { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }

    saveBtn.addEventListener('click', onSave);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
  });
}
