import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressWorkPhoto, fitWorkPhotoDimensions, prepareWorkPhotos, WORK_PHOTO_MAX_BYTES } from './work-photo';
import { render } from 'svelte/server';
import PhotoGallery from '$lib/components/media/PhotoGallery.svelte';

afterEach(() => vi.unstubAllGlobals());
const photo = (name = 'photo.jpg', type = 'image/jpeg') => new File(['photo'], name, { type });

describe('work photos', () => {
  it('fits portrait and landscape photos without upscaling', () => {
    expect(fitWorkPhotoDimensions(4000, 2000)).toEqual({ width: 1600, height: 800 });
    expect(fitWorkPhotoDimensions(2000, 4000)).toEqual({ width: 800, height: 1600 });
    expect(fitWorkPhotoDimensions(100, 50)).toEqual({ width: 100, height: 50 });
    expect(() => fitWorkPhotoDimensions(0, 50)).toThrow();
  });
  it('compresses sequentially so at most one decoded photo is in memory', async () => {
    const visited: string[] = []; let active = 0;
    const output = await prepareWorkPhotos([photo('one.jpg'), photo('two.jpg')], 0, async file => {
      active++; expect(active).toBe(1); visited.push(file.name);
      await Promise.resolve(); active--; return file;
    });
    expect(visited).toEqual(['one.jpg', 'two.jpg']);
    expect(output.map(file => file.name)).toEqual(visited);
  });
  it('rejects excess photos and unsupported types before decoding', async () => {
    const compress = vi.fn(async (file: File) => file);
    await expect(prepareWorkPhotos([photo(), photo()], 9, compress)).rejects.toThrow();
    await expect(prepareWorkPhotos([photo('vector.svg', 'image/svg+xml')], 0, compress)).rejects.toThrow();
    expect(compress).not.toHaveBeenCalled();
  });
  it('never returns an oversized compressed file', async () => {
    await expect(prepareWorkPhotos([photo()], 0, async () => new File([new Uint8Array(WORK_PHOTO_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' }))).rejects.toThrow();
  });
  it('resizes, encodes and releases the bitmap and canvas', async () => {
    const close = vi.fn(), drawImage = vi.fn();
    const bitmap = { width: 4000, height: 2000, close };
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, fillRect: vi.fn(), fillStyle: '' }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })) };
    vi.stubGlobal('createImageBitmap', async () => bitmap);
    vi.stubGlobal('document', { createElement: () => canvas });
    const result = await compressWorkPhoto(photo('camera.png', 'image/png'));
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('camera.jpg');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800);
    expect(close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
  it('releases decoded resources if encoding fails', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 50, close }));
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    await expect(compressWorkPhoto(photo())).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('work photo gallery rendering', () => {
  it('provides named thumbnail buttons and allows multiple draft photos', () => {
    const { body } = render(PhotoGallery, { props: { photos: [{ key: 'one', src: 'blob:one', alt: 'First' }, { key: 'two', src: 'blob:two', alt: 'Second' }] } });
    expect(body).toContain('Открыть фото 1');
    expect(body).toContain('Открыть фото 2');
    expect(body).toContain('alt="First"');
    expect(body).not.toContain('<dialog');
    expect(body).not.toContain('Удалить фото');
  });
  it('offers removal only to an editable caller', () => {
    const { body } = render(PhotoGallery, { props: { photos: [{ key: 'one', src: 'blob:one', alt: 'Photo' }], onremove: () => {} } });
    expect(body).toContain('Удалить фото 1');
  });
});
