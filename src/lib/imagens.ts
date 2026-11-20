function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Não consegui abrir a imagem "${arquivo.name}".`))
    }
    img.src = url
  })
}

/** Corta no centro em quadrado e reduz para `lado` px (nunca amplia). */
function quadrar(img: HTMLImageElement, lado: number, qualidade: number): Promise<Blob> {
  const menor = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - menor) / 2
  const sy = (img.naturalHeight - menor) / 2
  const saida = Math.max(1, Math.round(Math.min(lado, menor)))
  const canvas = document.createElement('canvas')
  canvas.width = saida
  canvas.height = saida
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Seu navegador não conseguiu processar a imagem.'))
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, saida, saida)
  ctx.drawImage(img, sx, sy, menor, menor, 0, 0, saida, saida)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem.'))),
      'image/jpeg',
      qualidade,
    ),
  )
}

/** Foto do iPad/celular cortada em quadrado, em dois tamanhos: ampliada (1400px) e miniatura (480px). */
export async function prepararImagem(arquivo: File): Promise<{ grande: Blob; miniatura: Blob }> {
  const img = await carregar(arquivo)
  const [grande, miniatura] = await Promise.all([quadrar(img, 1400, 0.82), quadrar(img, 480, 0.75)])
  return { grande, miniatura }
}
