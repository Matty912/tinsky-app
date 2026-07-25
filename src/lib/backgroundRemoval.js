// Quitado de fondo 100% client-side usando @imgly/background-removal
// (modelo que corre en el navegador vía WASM — no manda la foto a ningún
// servidor, no requiere API key ni tiene costo). La librería se carga
// de forma diferida (import dinámico) para no inflar el bundle inicial;
// la primera vez que se usa, descarga el modelo (unos MB) desde su CDN.

export async function quitarFondo(dataUri, onProgress) {
  const { removeBackground } = await import("@imgly/background-removal");
  const resultBlob = await removeBackground(dataUri, {
    progress: (key, current, total) => {
      if (onProgress) onProgress(current / total);
    },
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}

// Compone la imagen (ya sin fondo, con transparencia) sobre el fondo elegido.
export function componerFondo(dataUriSinFondo, opcion, color1, color2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (opcion === "blanco") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (opcion === "color") {
        ctx.fillStyle = color1 || "#7A1930";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (opcion === "degradado") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, color1 || "#7A1930");
        grad.addColorStop(1, color2 || "#1F4FC4");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // "transparente" no dibuja fondo, queda el canvas transparente

      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUriSinFondo;
  });
}
