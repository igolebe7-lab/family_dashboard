import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarCropGeometry, cropAvatarFile, loadAvatarSource, validateAvatarSource } from './avatar-crop';

afterEach(() => vi.unstubAllGlobals());

describe('avatar crop geometry', () => {
  it('centres a landscape photo and covers the circle without stretching', () => {
    expect(avatarCropGeometry(1200, 800, 240, 1, 0, 0)).toEqual({
      scale: 0.3, width: 360, height: 240, x: -60, y: 0,
      sourceX: 200, sourceY: 0, sourceSize: 800
    });
  });
  it('clamps dragging at both image edges with zoom', () => {
    const left = avatarCropGeometry(800, 1200, 240, 2, -999, 999);
    expect(left.x).toBe(-240);
    expect(left.y).toBe(0);
    expect(left.sourceX + left.sourceSize).toBe(800);
    expect(left.sourceY).toBe(0);
    const right = avatarCropGeometry(800, 1200, 240, 2, 999, -999);
    expect(right.x).toBe(0);
    expect(right.sourceY + right.sourceSize).toBe(1200);
  });
  it('keeps the crop square for tiny images and limits zoom', () => {
    expect(avatarCropGeometry(40, 20, 240, 0, 0, 0).sourceSize).toBe(20);
    expect(avatarCropGeometry(1000, 1000, 240, 99, 0, 0).sourceSize).toBe(250);
  });
  it('rejects invalid dimensions and nonfinite offsets', () => {
    for (const args of [[0, 100, 240, 1, 0, 0], [100, 100, 0, 1, 0, 0], [100, 100, 240, 1, NaN, 0]]) {
      expect(() => avatarCropGeometry(...args as [number, number, number, number, number, number])).toThrow();
    }
  });
});

describe('avatar processing', () => {
  it('accepts supported raster photos but rejects SVG, empty and oversized files', () => {
    expect(() => validateAvatarSource(new File(['photo'], 'photo.png', { type: 'image/png' }))).not.toThrow();
    expect(() => validateAvatarSource(new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' }))).toThrow();
    expect(() => validateAvatarSource(new File([], 'photo.jpg', { type: 'image/jpeg' }))).toThrow();
    expect(() => validateAvatarSource(new File([new Uint8Array(21 * 1024 * 1024)], 'photo.jpg', { type: 'image/jpeg' }))).toThrow();
  });
  it('exports only the selected square to a fresh 512px compressed JPEG', async () => {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, fillRect, fillStyle: '' }),
      toBlob: vi.fn((callback: (blob: Blob) => void) => callback(new Blob(['cropped'], { type: 'image/jpeg' }))) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
    const file = await cropAvatarFile(image, avatarCropGeometry(1200, 800, 240));
    expect(canvas.width).toBe(512); expect(canvas.height).toBe(512);
    expect(drawImage).toHaveBeenCalledWith(image, 200, 0, 800, 800, 0, 0, 512, 512);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(file.name).toBe('avatar.jpg'); expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('cropped');
  });
  it('revokes an object URL when the source cannot be decoded', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:source', revokeObjectURL });
    vi.stubGlobal('Image', class { src = ''; decode() { return Promise.reject(new Error('decode failed')); } });
    await expect(loadAvatarSource(new File(['broken'], 'photo.jpg', { type: 'image/jpeg' }))).rejects.toThrow('decode failed');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:source');
  });
});
