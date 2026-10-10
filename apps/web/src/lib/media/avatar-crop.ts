export type AvatarCropGeometry = {
  scale: number;
  width: number;
  height: number;
  x: number;
  y: number;
  sourceX: number;
  sourceY: number;
  sourceSize: number;
};

export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_MAX_ZOOM = 4;

export function avatarCropGeometry(
  imageWidth: number, imageHeight: number, viewport: number,
  zoom = 1, offsetX = 0, offsetY = 0
): AvatarCropGeometry {
  if (![imageWidth, imageHeight, viewport, zoom, offsetX, offsetY].every(Number.isFinite) ||
      imageWidth <= 0 || imageHeight <= 0 || viewport <= 0) {
    throw new Error('Invalid avatar crop dimensions');
  }
  const scale = Math.max(viewport / imageWidth, viewport / imageHeight) * Math.min(AVATAR_MAX_ZOOM, Math.max(1, zoom));
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = Math.min(0, Math.max(viewport - width, (viewport - width) / 2 + offsetX));
  const y = Math.min(0, Math.max(viewport - height, (viewport - height) / 2 + offsetY));
  return { scale, width, height, x, y, sourceX: -x / scale || 0, sourceY: -y / scale || 0, sourceSize: viewport / scale };
}

export function validateAvatarSource(file: File): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Выберите фото в формате JPEG, PNG или WebP.');
  }
  if (file.size > 20 * 1024 * 1024 || file.size === 0) {
    throw new Error('Выберите фото размером до 20 МБ.');
  }
}

export async function loadAvatarSource(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  validateAvatarSource(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 48_000_000) {
      throw new Error('Фото слишком большое. Выберите изображение до 48 мегапикселей.');
    }
    return { image, url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function cropAvatarFile(image: HTMLImageElement, crop: AvatarCropGeometry): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить фото.');
  // A square file keeps opaque corners; the display component supplies the circle.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  context.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceSize, crop.sourceSize,
    0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    result => result ? resolve(result) : reject(new Error('Не удалось обработать фото.')), 'image/jpeg', 0.85
  ));
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
