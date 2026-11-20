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

function redimensionar(img: HTMLImageElement, lado: number, qualidade: number): Promise<Blob> {
  const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
  const largura = Math.max(1, Math.round(img.naturalWidth * escala))
  const altura = Math.max(1, Math.round(img.naturalHeight * escala))
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Seu navegador não conseguiu processar a imagem.'))
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(img, 0, 0, largura, altura)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem.'))),
      'image/jpeg',
      qualidade,
    ),
  )
}

/** Reduz a foto do iPad/celular para dois tamanhos: ampliada (1600px) e miniatura (480px). */
export async function prepararImagem(arquivo: File): Promise<{ grande: Blob; miniatura: Blob }> {
  const img = await carregar(arquivo)
  const [grande, miniatura] = await Promise.all([redimensionar(img, 1600, 0.82), redimensionar(img, 480, 0.75)])
  return { grande, miniatura }
}
