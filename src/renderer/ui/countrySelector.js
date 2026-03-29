export function initCountrySelector(countries, currentCode, onChange) {
  const select = document.getElementById('country-select');
  for (const c of countries) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.flag} ${c.code}`;
    select.appendChild(opt);
  }
  select.value = currentCode;
  select.addEventListener('change', () => onChange(select.value));
}

export function setCountrySelector(code) {
  const select = document.getElementById('country-select');
  if (select) select.value = code;
}
