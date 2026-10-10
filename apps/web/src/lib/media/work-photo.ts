export const WORK_PHOTO_MAX_COUNT = 10;
export const WORK_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const WORK_PHOTO_MAX_EDGE = 1600;
const INPUT_MAX_BYTES = 30 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function fitWorkPhotoDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Не удалось прочитать размер фотографии.');
  const ratio = Math.min(1, WORK_PHOTO_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

function validatePhoto(file: File): void {
  if (!PHOTO_TYPES.has(file.type)) throw new Error('Выберите фото в формате JPEG, PNG или WebP.');
  if (!file.size || file.size > INPUT_MAX_BYTES) throw new Error('Исходное фото должно быть не больше 30 МБ и не быть пустым.');
}

async function decodePhoto(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Не удалось прочитать фото.'));
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => { image.src = ''; URL.revokeObjectURL(url); } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function compressWorkPhoto(file: File): Promise<File> {
  validatePhoto(file);
  const decoded = await decodePhoto(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    if (decoded.width * decoded.height > 40_000_000) throw new Error('Фото слишком большое. Выберите изображение до 40 мегапикселей.');
    const size = fitWorkPhotoDimensions(decoded.width, decoded.height);
    canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось подготовить фотографию.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(decoded.image, 0, 0, size.width, size.height);
    for (const quality of [0.85, 0.72, 0.58]) {
      const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value ? resolve(value) : reject(new Error('Не удалось сжать фотографию.')), 'image/jpeg', quality));
      if (blob.size <= WORK_PHOTO_MAX_BYTES) return new File([blob], `${file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'photo'}.jpg`, { type: 'image/jpeg' });
    }
    throw new Error('Не удалось уменьшить фото до 2 МБ. Выберите другое изображение.');
  } finally {
    decoded.release();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

export async function prepareWorkPhotos(files: readonly File[], existingCount = 0, compress: (file: File) => Promise<File> = compressWorkPhoto): Promise<File[]> {
  if (!Number.isInteger(existingCount) || existingCount < 0 || existingCount + files.length > WORK_PHOTO_MAX_COUNT) throw new Error('К выполнению дела можно добавить не больше 10 фото.');
  files.forEach(validatePhoto);
  const prepared: File[] = [];
  // Sequential decoding bounds memory on mobile devices.
  for (const file of files) {
    const result = await compress(file);
    if (!result.size || result.size > WORK_PHOTO_MAX_BYTES || !PHOTO_TYPES.has(result.type)) throw new Error('Подготовленное фото должно быть не больше 2 МБ.');
    prepared.push(result);
  }
  return prepared;
}
