export async function initTitlebar() {
  const version = await window.energysrc.getVersion();
  document.getElementById('version').textContent = `v${version}`;
  document.getElementById('close-btn').addEventListener('click', () => {
    window.energysrc.closeWindow();
  });
}
