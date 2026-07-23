export function initGymBarcode() {
  document.getElementById('gym-barcode-close').addEventListener('click', closeGymBarcode);
}

export function openGymBarcode() {
  document.getElementById('gym-barcode-overlay').classList.add('visible');
}

function closeGymBarcode() {
  document.getElementById('gym-barcode-overlay').classList.remove('visible');
}
